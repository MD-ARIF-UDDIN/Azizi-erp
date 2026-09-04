import React, { useState, useEffect, useRef } from 'react';
import { db } from '../../lib/db';
import type { Customer, ClientDocument, Service } from '../../types/database';
import { PermissionGuard } from '../../components/PermissionGuard';
import { useAuth } from '../../components/AuthProvider';
import { useNavigate } from 'react-router-dom';
import { exportCustomers } from '../../lib/excelExport';
import {
  Plus,
  Minus,
  Trash2,
  X,
  Search,
  Phone,
  Mail,
  MapPin,
  FileText,
  AlertTriangle,
  History,
  Calendar,
  Printer,
  ShoppingCart,
  ReceiptText,
  Percent,
  CreditCard,
  MessageSquare,
  User,
  Users,
  Building2,
  Download,
  Pencil,
  CheckCircle2,
  ChevronDown,
  FileSpreadsheet,
  Coins
} from 'lucide-react';

const handleWhatsAppShare = (sale: any) => {
  const customerName = sale.customer?.name || 'Customer';
  const invoiceNo = sale.invoice_no;
  const grandTotal = sale.grand_total.toFixed(2);
  const itemsText = sale.items?.map((i: any) => `• ${i.service?.name || 'Service'} (Qty: ${i.quantity}) - ${(i.subtotal || 0).toFixed(2)} AED`).join('\n') || '';
  const totalPaid = sale.payments?.reduce((sum: number, p: any) => sum + p.amount, 0) || 0;
  const due = Math.max(0, sale.grand_total - totalPaid).toFixed(2);

  const message = `*AZIZI TYPING & STAMP MAKING*
Musaffah M37, Abu Dhabi
Tel: 0542797933

Dear *${customerName}*,
Here is the summary of your invoice:

*Invoice No:* #${invoiceNo}
*Date:* ${new Date(sale.created_at).toLocaleDateString()}

*Services Billing:*
${itemsText}

*Grand Total:* ${grandTotal} AED
*Outstanding Dues:* ${due} AED

Thank you for choosing AZIZI!`;

  const rawPhone = sale.customer?.phone || '';
  const phone = rawPhone.replace(/\D/g, ''); // Remove non-numeric characters
  const url = phone 
    ? `https://wa.me/${phone}?text=${encodeURIComponent(message)}`
    : `https://wa.me/?text=${encodeURIComponent(message)}`;
    
  window.open(url, '_blank');
};

const getDaysRemaining = (expiryDateStr: string) => {
  const expiry = new Date(expiryDateStr);
  const today = new Date();
  expiry.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);
  const diffTime = expiry.getTime() - today.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};



interface QsCartItem {
  service: Service;
  quantity: number;
  unit_price: number;
  person_name?: string;
  notes?: string;
}

export const CustomerList: React.FC = () => {
  const { hasPermission, user } = useAuth();
  const navigate = useNavigate();
  
  // Data States
  const [customers, setCustomers] = useState<(Customer & { due: number; sales_count: number })[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCustomer, setSelectedCustomer] = useState<any | null>(null);
  const [selectedCustDocs, setSelectedCustDocs] = useState<ClientDocument[]>([]);
  const [custDetailTab, setCustDetailTab] = useState<'invoices' | 'documents' | 'members' | 'info'>('invoices');

  const [searchQuery, setSearchQuery] = useState('');
  const [filterDueOnly, setFilterDueOnly] = useState(false);
  const [printSaleData, setPrintSaleData] = useState<any | null>(null);
  const [isPrinting, setIsPrinting] = useState(false);
  const [isPrintingCustomerList, setIsPrintingCustomerList] = useState(false);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);

  // --- Quick Sale State ---
  const [qsCustomer, setQsCustomer] = useState<any | null>(null);
  const [qsPersonName, setQsPersonName] = useState('');
  const [qsServices, setQsServices] = useState<Service[]>([]);
  const [qsCategories, setQsCategories] = useState<any[]>([]);
  const [qsSearch, setQsSearch] = useState('');
  const [qsCategory, setQsCategory] = useState('all');
  const [qsIsSearchOpen, setQsIsSearchOpen] = useState(false);
  const [qsHighlightIndex, setQsHighlightIndex] = useState(0);
  const qsSearchContainerRef = useRef<HTMLDivElement>(null);
  const qsSearchInputRef = useRef<HTMLInputElement>(null);
  const [qsCart, setQsCart] = useState<QsCartItem[]>([]);
  const [qsDiscount, setQsDiscount] = useState(0);
  const [qsNotes, setQsNotes] = useState('');
  const [qsSaving, setQsSaving] = useState(false);
  const [qsError, setQsError] = useState('');

  // Quick Sale Advance Modal States
  const [qsShowAdvanceModal, setQsShowAdvanceModal] = useState(false);
  const [qsAdvanceEntries, setQsAdvanceEntries] = useState<{
    saleId: string;
    invoiceNo: string;
    memberName: string;
    grandTotal: number;
    amount: number;
    method: 'Cash' | 'Card' | 'Mobile Banking' | 'Bank Transfer';
    notes: string;
  }[]>([]);
  const [qsCreatedSaleIds, setQsCreatedSaleIds] = useState<string[]>([]);
  const [qsSavingAdvance, setQsSavingAdvance] = useState(false);

  // --- Quick Payment State ---
  const [qpCustomer, setQpCustomer] = useState<any | null>(null);
  const [qpSales, setQpSales] = useState<any[]>([]);
  const [qpSelectedSaleId, setQpSelectedSaleId] = useState('');
  const [qpAmount, setQpAmount] = useState(0);
  const [qpMethod, setQpMethod] = useState<'Cash' | 'Card' | 'Mobile Banking' | 'Bank Transfer'>('Cash');
  const [qpTxNo, setQpTxNo] = useState('');
  const [qpNotes, setQpNotes] = useState('');
  const [qpPersonName, setQpPersonName] = useState('');
  const [qpSaving, setQpSaving] = useState(false);
  const [qpError, setQpError] = useState('');

  // --- Edit Invoice Items State ---
  const [editItemsModalOpen, setEditItemsModalOpen] = useState(false);
  const [editingSaleId, setEditingSaleId] = useState<string | null>(null);
  const [editingSale, setEditingSale] = useState<any | null>(null);
  const [editingSaleItems, setEditingSaleItems] = useState<any[]>([]);
  const [allServices, setAllServices] = useState<any[]>([]);
  const [addServiceId, setAddServiceId] = useState('');
  const [addQty, setAddQty] = useState(1);
  const [addPrice, setAddPrice] = useState(0);
  const [editSaving, setEditSaving] = useState(false);

  // --- Create/Edit Customer Modal State ---
  const [customerModalOpen, setCustomerModalOpen] = useState(false);
  const [editingCustomerId, setEditingCustomerId] = useState<string | null>(null);
  const [customerForm, setCustomerForm] = useState({
    name: '',
    phone: '',
    email: '',
    address: '',
    notes: '',
    customer_type: 'individual' as 'individual' | 'company'
  });
  const [peopleUnderCompany, setPeopleUnderCompany] = useState<{ id?: string; name: string; phone?: string; email?: string }[]>([]);
  const [newPersonName, setNewPersonName] = useState('');
  const [newPersonPhone, setNewPersonPhone] = useState('');
  const [newPersonEmail, setNewPersonEmail] = useState('');
  const [customerModalSaving, setCustomerModalSaving] = useState(false);
  const [customerModalError, setCustomerModalError] = useState('');

  const openCreateCustomerModal = () => {
    setEditingCustomerId(null);
    setCustomerForm({
      name: '',
      phone: '',
      email: '',
      address: '',
      notes: '',
      customer_type: 'individual'
    });
    setPeopleUnderCompany([]);
    setNewPersonName('');
    setNewPersonPhone('');
    setNewPersonEmail('');
    setCustomerModalError('');
    setCustomerModalOpen(true);
  };

  const openEditCustomerModal = (cust: any) => {
    setEditingCustomerId(cust.id);
    setCustomerForm({
      name: cust.name || '',
      phone: cust.phone || '',
      email: cust.email || '',
      address: cust.address || '',
      notes: cust.notes || '',
      customer_type: cust.customer_type || 'individual'
    });
    setPeopleUnderCompany(Array.isArray(cust.members) ? cust.members : []);
    setNewPersonName('');
    setNewPersonPhone('');
    setNewPersonEmail('');
    setCustomerModalError('');
    setCustomerModalOpen(true);
  };

  const handleAddPerson = () => {
    if (!newPersonName.trim()) return;
    setPeopleUnderCompany(prev => [
      ...prev,
      {
        id: crypto.randomUUID(),
        name: newPersonName.trim(),
        phone: newPersonPhone.trim() || undefined,
        email: newPersonEmail.trim() || undefined
      }
    ]);
    setNewPersonName('');
    setNewPersonPhone('');
    setNewPersonEmail('');
  };

  const handleRemovePerson = (idx: number) => {
    setPeopleUnderCompany(prev => prev.filter((_, i) => i !== idx));
  };

  const handleSaveCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerForm.name.trim()) {
      setCustomerModalError(customerForm.customer_type === 'company' ? 'Company name is required.' : 'Person full name is required.');
      return;
    }

    setCustomerModalSaving(true);
    setCustomerModalError('');
    try {
      const payload: any = {
        name: customerForm.name.trim(),
        phone: customerForm.phone.trim() || null,
        email: customerForm.email.trim() || null,
        address: customerForm.address.trim() || null,
        notes: customerForm.notes.trim() || null,
        customer_type: customerForm.customer_type,
        members: customerForm.customer_type === 'company' ? peopleUnderCompany : []
      };

      if (editingCustomerId) {
        await db.customers.update(editingCustomerId, payload);
      } else {
        await db.customers.create(payload);
      }

      setCustomerModalOpen(false);
      await fetchCustomers();
      if (selectedCustomer && editingCustomerId && selectedCustomer.id === editingCustomerId) {
        const refreshed = await db.customers.getById(editingCustomerId);
        setSelectedCustomer(refreshed);
      }
    } catch (err: any) {
      setCustomerModalError(err.message || 'Failed to save customer.');
    } finally {
      setCustomerModalSaving(false);
    }
  };

  const handleOpenEditItems = async (saleId: string) => {
    try {
      setEditingSaleId(saleId);
      const detail = await db.sales.getById(saleId);
      setEditingSale(detail);
      setEditingSaleItems(detail?.items || []);
      const svcs = await db.services.getAll();
      setAllServices(svcs.filter(s => s.status === 'Active'));
      setAddServiceId('');
      setAddQty(1);
      setAddPrice(0);
      setEditItemsModalOpen(true);
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddItem = async () => {
    if (!editingSaleId || !addServiceId || addQty <= 0) return;
    setEditSaving(true);
    try {
      await db.sales.addItem(editingSaleId, { service_id: addServiceId, quantity: addQty, unit_price: addPrice, staff_id: user?.id });
      const detail = await db.sales.getById(editingSaleId);
      setEditingSale(detail);
      setEditingSaleItems(detail?.items || []);
      setAddServiceId('');
      setAddQty(1);
      setAddPrice(0);
      await fetchCustomers();
    } catch (err) {
      console.error(err);
    } finally {
      setEditSaving(false);
    }
  };

  const handleRemoveItem = async (itemId: string) => {
    if (!editingSaleId || !window.confirm('Remove this item from the invoice?')) return;
    setEditSaving(true);
    try {
      await db.sales.removeItem(editingSaleId, itemId);
      const detail = await db.sales.getById(editingSaleId);
      setEditingSale(detail);
      setEditingSaleItems(detail?.items || []);
      await fetchCustomers();
    } catch (err) {
      console.error(err);
    } finally {
      setEditSaving(false);
    }
  };

  const fetchCustomers = async () => {
    setLoading(true);
    try {
      const data = await db.customers.getAll();
      let allDocs: ClientDocument[] = [];
      try {
        allDocs = await db.clientDocuments.getAll();
      } catch (docErr) {
        console.error('Failed to load client documents:', docErr);
      }

      const mapped = data.map((c: any) => {
        const customerDocs = allDocs.filter((d: any) => d.customer_id === c.id);
        return {
          ...c,
          documents: customerDocs
        };
      });

      setCustomers(mapped);

      // If a customer is open in detail view, refresh their details
      if (selectedCustomer) {
        const refreshed = await db.customers.getById(selectedCustomer.id);
        setSelectedCustomer(refreshed);
        const docs = await db.clientDocuments.getByCustomerId(selectedCustomer.id);
        setSelectedCustDocs(docs);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };


  useEffect(() => {
    fetchCustomers();
  }, []);

  const handleOpenDetail = async (cust: Customer) => {
    setLoading(true);
    setCustDetailTab('invoices');
    try {
      const detailed = await db.customers.getById(cust.id);
      setSelectedCustomer(detailed);
      const docs = await db.clientDocuments.getByCustomerId(cust.id);
      setSelectedCustDocs(docs);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this customer? This soft-deletes the record.')) {
      await db.customers.delete(id);
      setSelectedCustomer(null);
      await fetchCustomers();
    }
  };

  const handlePrintSale = async (saleId: string) => {
    setIsPrinting(true);
    try {
      const detail = await db.sales.getById(saleId);
      setPrintSaleData(detail);
      setTimeout(() => {
        window.print();
        setTimeout(() => {
          setPrintSaleData(null);
          setIsPrinting(false);
        }, 500);
      }, 400);
    } catch (err) {
      console.error(err);
      setIsPrinting(false);
    }
  };

  const handlePrintCustomerDirectory = () => {
    setIsPrintingCustomerList(true);
    setIsPrinting(true);
    setTimeout(() => {
      window.print();
      setTimeout(() => {
        setIsPrintingCustomerList(false);
        setIsPrinting(false);
      }, 500);
    }, 400);
  };

  // --- Click Outside Handlers ---
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (qsSearchContainerRef.current && !qsSearchContainerRef.current.contains(event.target as Node)) {
        setQsIsSearchOpen(false);
      }
      if (exportMenuRef.current && !exportMenuRef.current.contains(event.target as Node)) {
        setExportMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const openQuickSale = async (cust: any, preselectedPersonName?: string) => {
    const [services, cats] = await Promise.all([
      db.services.getAll(),
      db.serviceCategories.getAll()
    ]);
    setQsServices(services.filter(s => s.status === 'Active'));
    setQsCategories(cats);
    setQsSearch('');
    setQsCategory('all');
    setQsIsSearchOpen(false);
    setQsHighlightIndex(0);
    setQsCustomer(cust);
    setQsPersonName(preselectedPersonName || '');
    setQsCart([]);
    setQsDiscount(0);
    setQsNotes('');
    setQsError('');
    setQsShowAdvanceModal(false);
    setQsAdvanceEntries([]);
    setQsCreatedSaleIds([]);
  };

  const qsFilteredServices = qsServices.filter(s => {
    const matchesCat = qsCategory === 'all' || s.category_id === qsCategory;
    const catName = (s as any).category?.name || '';
    const q = qsSearch.trim().toLowerCase();
    const matchesSearch = !q || s.name.toLowerCase().includes(q) || catName.toLowerCase().includes(q);
    return matchesCat && matchesSearch;
  });

  const qsAddService = (service: Service) => {
    const assignedPerson = qsPersonName || undefined;
    const idx = qsCart.findIndex(i => i.service.id === service.id && i.person_name === assignedPerson);
    if (idx !== -1) {
      const updated = [...qsCart];
      updated[idx].quantity += 1;
      setQsCart(updated);
    } else {
      setQsCart([...qsCart, { service, quantity: 1, unit_price: service.price, person_name: assignedPerson }]);
    }
  };

  const handleQsSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!qsIsSearchOpen && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      setQsIsSearchOpen(true);
      return;
    }
    if (qsFilteredServices.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setQsHighlightIndex(prev => (prev + 1) % qsFilteredServices.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setQsHighlightIndex(prev => (prev - 1 + qsFilteredServices.length) % qsFilteredServices.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const targetService = qsFilteredServices[qsHighlightIndex] || qsFilteredServices[0];
      if (targetService) {
        qsAddService(targetService);
        setQsSearch('');
        setQsIsSearchOpen(false);
      }
    } else if (e.key === 'Escape') {
      setQsIsSearchOpen(false);
      qsSearchInputRef.current?.blur();
    }
  };

  const qsUpdateQty = (idx: number, delta: number) => {
    const updated = [...qsCart];
    const newQty = updated[idx].quantity + delta;
    if (newQty <= 0) updated.splice(idx, 1);
    else updated[idx].quantity = newQty;
    setQsCart(updated);
  };

  const qsUpdatePriceOverride = (idx: number, newPrice: number) => {
    if (newPrice < 0) return;
    const updated = [...qsCart];
    updated[idx].unit_price = newPrice;
    setQsCart(updated);
  };

  // Member grouping for multi-member split invoices
  const qsMemberGroups = (() => {
    const map: Record<string, { memberKey: string; displayName: string; items: QsCartItem[]; subtotal: number }> = {};
    qsCart.forEach(item => {
      const key = (item.person_name || '').trim();
      const displayName = key || (qsCustomer?.customer_type === 'company' ? 'Company General' : qsCustomer?.name || 'Customer');
      if (!map[key]) {
        map[key] = { memberKey: key, displayName, items: [], subtotal: 0 };
      }
      map[key].items.push(item);
      map[key].subtotal += item.unit_price * item.quantity;
    });
    return Object.values(map);
  })();

  const qsSubmit = async () => {
    if (qsCart.length === 0) { setQsError('Please add at least one service to the invoice.'); return; }
    const branchId = user?.branch_id;
    if (!branchId) { setQsError('No branch assigned to your account.'); return; }
    setQsSaving(true);
    setQsError('');
    try {
      const totalSubtotal = qsCart.reduce((s, i) => s + i.unit_price * i.quantity, 0);
      const groups = qsMemberGroups;

      // Auto-save any newly typed or assigned person names into the existing customer's members list
      if (qsCustomer?.id) {
        const existingMembers = qsCustomer.members || [];
        const existingNames = new Set(existingMembers.map((m: any) => m.name.toLowerCase().trim()));
        const newNames = Array.from(new Set(
          qsCart.map(i => i.person_name?.trim()).filter(Boolean) as string[]
        )).filter(name => !existingNames.has(name.toLowerCase()));

        if (newNames.length > 0) {
          const updatedMembers = [
            ...existingMembers,
            ...newNames.map(name => ({ id: crypto.randomUUID(), name }))
          ];
          await db.customers.update(qsCustomer.id, {
            members: updatedMembers,
            customer_type: 'company'
          });
          setCustomers(prev => prev.map(c => c.id === qsCustomer.id ? { ...c, members: updatedMembers, customer_type: 'company' } : c));
        }
      }

      const createdSales: any[] = [];
      for (const group of groups) {
        const groupDiscount = totalSubtotal > 0 ? (group.subtotal / totalSubtotal) * qsDiscount : 0;
        const groupItems = group.items.map(i => ({
          service_id: i.service.id,
          quantity: i.quantity,
          unit_price: i.unit_price,
          person_name: group.memberKey || undefined,
          staff_id: user?.id,
          notes: i.notes || undefined
        }));

        const createdSale = await db.sales.create({
          customer_id: qsCustomer?.id,
          branch_id: branchId,
          discount: parseFloat(groupDiscount.toFixed(2)),
          notes: qsNotes || undefined,
          person_name: group.memberKey || undefined,
          items: groupItems
        });
        createdSales.push(createdSale);
      }

      const advanceList = createdSales.map((s, idx) => ({
        saleId: s.id,
        invoiceNo: s.invoice_no,
        memberName: groups[idx]?.displayName || s.person_name || 'Customer',
        grandTotal: s.grand_total,
        amount: 0,
        method: 'Cash' as const,
        notes: ''
      }));

      setQsCreatedSaleIds(createdSales.map(s => s.id));
      setQsAdvanceEntries(advanceList);
      setQsShowAdvanceModal(true);
      await fetchCustomers();
    } catch (err: any) {
      setQsError(err.message || 'Failed to create sale.');
    } finally {
      setQsSaving(false);
    }
  };

  const handleQsSaveAdvance = async () => {
    setQsSavingAdvance(true);
    try {
      for (const entry of qsAdvanceEntries) {
        if (entry.amount > 0) {
          await db.payments.create({
            sale_id: entry.saleId,
            amount: entry.amount,
            payment_method: entry.method,
            person_name: entry.memberName !== 'Company General' ? entry.memberName : undefined,
            notes: entry.notes || undefined
          });
        }
      }
      setQsShowAdvanceModal(false);
      setQsCustomer(null);
      await fetchCustomers();
      if (qsCreatedSaleIds.length > 0) {
        await handlePrintSale(qsCreatedSaleIds[0]);
      }
    } catch (err: any) {
      alert(err.message || 'Error recording advance payments');
    } finally {
      setQsSavingAdvance(false);
    }
  };

  const handleQsSkipAdvance = async () => {
    setQsShowAdvanceModal(false);
    setQsCustomer(null);
    await fetchCustomers();
    if (qsCreatedSaleIds.length > 0) {
      await handlePrintSale(qsCreatedSaleIds[0]);
    }
  };

  const qsSubtotal = qsCart.reduce((s, i) => s + i.unit_price * i.quantity, 0);
  const qsGrandTotal = Math.max(0, qsSubtotal - qsDiscount);

  // --- Quick Payment Handlers ---
  const openQuickPayment = async (cust: any) => {
    setLoading(true);
    setQpError('');
    try {
      const detailed = await db.customers.getById(cust.id);
      if (!detailed || !detailed.sales) {
        setQpError('Customer sales not found.');
        return;
      }
      
      const unpaidSales = detailed.sales.filter((s: any) => s.payment_status !== 'Paid');
      
      if (unpaidSales.length === 0) {
        alert('This customer has no unpaid invoices.');
        return;
      }

      const resolvedSales = [];
      for (const sale of unpaidSales) {
        const payments = await db.payments.getBySaleId(sale.id);
        const totalPaid = payments.reduce((sum: number, p: any) => sum + p.amount, 0);
        const remaining = Math.max(0, sale.grand_total - totalPaid);
        if (remaining > 0) {
          resolvedSales.push({
            ...sale,
            remaining,
            totalPaid
          });
        }
      }

      if (resolvedSales.length === 0) {
        alert('This customer has no outstanding dues.');
        return;
      }

      setQpCustomer(cust);
      setQpSales(resolvedSales);
      setQpSelectedSaleId(resolvedSales[0].id);
      setQpAmount(resolvedSales[0].remaining);
      setQpMethod('Cash');
      setQpTxNo('');
      setQpNotes('');
      setQpPersonName(resolvedSales[0]?.person_name || '');
    } catch (err: any) {
      console.error(err);
      alert('Failed to load unpaid invoices: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleQpSelectedSaleChange = (saleId: string) => {
    setQpSelectedSaleId(saleId);
    const sale = qpSales.find(s => s.id === saleId);
    if (sale) {
      setQpAmount(sale.remaining);
      setQpPersonName(sale.person_name || '');
    } else {
      setQpAmount(0);
      setQpPersonName('');
    }
  };

  const qpSubmit = async () => {
    if (!qpSelectedSaleId) {
      setQpError('Please select an invoice.');
      return;
    }
    if (qpAmount <= 0) {
      setQpError('Amount must be greater than zero.');
      return;
    }
    const targetSale = qpSales.find(s => s.id === qpSelectedSaleId);
    if (targetSale && qpAmount > targetSale.remaining) {
      setQpError(`Amount cannot exceed the remaining due of ${targetSale.remaining.toFixed(2)} AED.`);
      return;
    }

    setQpSaving(true);
    setQpError('');
    try {
      await db.payments.create({
        sale_id: qpSelectedSaleId,
        amount: qpAmount,
        payment_method: qpMethod,
        transaction_no: qpTxNo || undefined,
        notes: qpNotes || undefined,
        person_name: qpPersonName.trim() || undefined
      });
      setQpCustomer(null);
      await fetchCustomers();
    } catch (err: any) {
      setQpError(err.message || 'Payment recording failed.');
    } finally {
      setQpSaving(false);
    }
  };

  // Search & Filter
  const filteredCustomers = customers.filter(c => {
    const matchesSearch =
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.phone && c.phone.includes(searchQuery)) ||
      (c.email && c.email.toLowerCase().includes(searchQuery.toLowerCase()));
      
    const matchesDue = filterDueOnly ? c.due > 0 : true;

    return matchesSearch && matchesDue;
  });

  return (
    <PermissionGuard permission="Customer.View" fallback="ui">
      {/* MAIN FULL VIEW */}
      <div className="w-full">
        
        {/* CUSTOMER DIRECTORY LISTING */}
        <div className={`w-full space-y-4 ${printSaleData || isPrintingCustomerList ? 'print:hidden' : ''}`}>
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="text-xs font-bold text-primary uppercase tracking-wider mb-0.5">eCustomers</div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground m-0">Directory</h1>
            </div>
            {hasPermission('Customer.Create') && (
              <button
                onClick={openCreateCustomerModal}
                className="flex items-center gap-1.5 bg-primary hover:bg-primary-hover text-white px-4 py-2 rounded-xl text-xs font-bold shadow-md shadow-primary/20 transition-all cursor-pointer self-start sm:self-auto"
              >
                <Plus size={14} />
                <span>Register Customer</span>
              </button>
            )}
          </div>

          {/* Search & Filter Toolbar */}
          <div className="flex flex-col sm:flex-row items-center gap-3 bg-muted/30 p-3 rounded-xl border border-border">
            <div className="relative w-full sm:flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
              <input
                type="text"
                placeholder="Search by name, phone, or email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 text-foreground"
              />
            </div>
            
            <button
              onClick={() => setFilterDueOnly(!filterDueOnly)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border transition-all w-full sm:w-auto justify-center cursor-pointer ${
                filterDueOnly
                  ? 'bg-amber-500/10 text-amber-400 border-amber-500/30 font-semibold'
                  : 'border-border text-muted-foreground hover:bg-secondary/40'
              }`}
            >
              <AlertTriangle size={14} />
              Show Due Balance Only
            </button>

            {/* EXPORT DROPDOWN MENU */}
            <div className="relative w-full sm:w-auto" ref={exportMenuRef}>
              <button
                type="button"
                onClick={() => setExportMenuOpen(!exportMenuOpen)}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold border border-border text-foreground bg-muted/40 hover:bg-muted transition-all w-full sm:w-auto justify-center cursor-pointer shadow-xs"
              >
                <Download size={14} className="text-primary" />
                <span>Export</span>
                <ChevronDown size={13} className={`transition-transform duration-200 ${exportMenuOpen ? 'rotate-180' : ''}`} />
              </button>

              {exportMenuOpen && (
                <div className="absolute right-0 mt-2 w-52 bg-popover border border-border rounded-xl shadow-xl z-50 p-1.5 animate-in fade-in zoom-in-95">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setExportMenuOpen(false);
                      exportCustomers(filteredCustomers);
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium rounded-lg text-foreground hover:bg-emerald-500/10 hover:text-emerald-500 transition-colors text-left cursor-pointer"
                  >
                    <div className="p-1.5 rounded-lg bg-emerald-500/15 text-emerald-500 shrink-0">
                      <FileSpreadsheet size={15} />
                    </div>
                    <div>
                      <div className="font-bold">Export Excel</div>
                      <div className="text-[10px] text-muted-foreground">Spreadsheet (.xlsx)</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setExportMenuOpen(false);
                      handlePrintCustomerDirectory();
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium rounded-lg text-foreground hover:bg-rose-500/10 hover:text-rose-500 transition-colors text-left cursor-pointer mt-0.5"
                  >
                    <div className="p-1.5 rounded-lg bg-rose-500/15 text-rose-500 shrink-0">
                      <FileText size={15} />
                    </div>
                    <div>
                      <div className="font-bold">Export PDF / Print</div>
                      <div className="text-[10px] text-muted-foreground">Printable Report (.pdf)</div>
                    </div>
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Main Grid Table */}
          {loading ? (
            <div className="table-container p-12 text-center bg-card border border-border rounded-xl">
              <div className="flex flex-col items-center justify-center gap-3">
                <div className="h-8 w-8 border-3 border-primary border-t-transparent rounded-full animate-spin" />
                <span className="text-xs font-bold tracking-wider uppercase text-primary animate-pulse">Loading...</span>
                <p className="text-[11px] text-muted-foreground font-medium">Please wait while customers directory is being loaded...</p>
              </div>
            </div>
          ) : (
            <div className="table-container">
              <div className="overflow-x-auto">
                <table>
                  <thead>
                    <tr>
                      <th className="text-center" style={{ width: '45px' }}>SL</th>
                      <th>Customer & Contact</th>
                      <th>Account Type</th>
                      <th className="text-right">Grand Total</th>
                      <th className="text-right">Total Paid</th>
                      <th className="text-right">Outstanding Due</th>
                      <th>Active Documents</th>
                      <th className="text-center">Invoices</th>
                      <th className="text-center" style={{ width: '160px' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCustomers.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="py-12 text-center text-slate-500">
                          <div className="max-w-xs mx-auto space-y-1">
                            <div className="font-bold text-black text-sm font-heading">No customers found</div>
                            <div className="text-xs text-slate-500">Click "Register Customer" to add a new person or company.</div>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      filteredCustomers.map((c: any, idx) => {
                        const anyDocExpiringSoon = c.documents?.some((doc: any) => getDaysRemaining(doc.expiry_date) <= 7);
                        const isSelected = selectedCustomer?.id === c.id;

                        return (
                          <tr
                            key={c.id}
                            onClick={() => handleOpenDetail(c)}
                            className={`cursor-pointer ${
                              isSelected ? 'bg-primary/5 font-semibold' : ''
                            } ${
                              anyDocExpiringSoon ? 'bg-rose-500/5 hover:bg-rose-500/10' : ''
                            }`}
                          >
                            {/* Serial */}
                            <td className="text-center font-semibold text-xs text-slate-500">
                              {idx + 1}
                            </td>

                            {/* Customer Details */}
                            <td>
                              <div className="font-bold text-black text-xs flex items-center gap-1.5">
                                {c.customer_type === 'company' ? (
                                  <Building2 size={14} className="text-primary shrink-0" />
                                ) : (
                                  <User size={14} className="text-primary shrink-0" />
                                )}
                                <span>{c.name}</span>
                              </div>
                              <div className="text-[11px] text-slate-600 flex items-center gap-3 mt-1">
                                {c.phone && (
                                  <span className="flex items-center gap-1 font-medium">
                                    <Phone size={11} className="text-primary" /> {c.phone}
                                  </span>
                                )}
                                {c.email && (
                                  <span className="flex items-center gap-1">
                                    <Mail size={11} /> {c.email}
                                  </span>
                                )}
                              </div>
                            </td>

                            {/* Account Type */}
                            <td>
                              {c.customer_type === 'company' ? (
                                <div className="flex flex-wrap items-center gap-1.5">
                                  <span className="bg-sky-50 text-sky-700 text-[10px] font-bold px-2 py-0.5 rounded border border-sky-200 inline-flex items-center gap-1 font-heading">
                                    <Building2 size={11} /> Company
                                  </span>
                                  {c.members && c.members.length > 0 && (
                                    <span className="text-[10px] bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded font-semibold border border-slate-200">
                                      👥 {c.members.length} {c.members.length === 1 ? 'person' : 'people'}
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <span className="bg-slate-100 text-slate-700 text-[10px] font-bold px-2 py-0.5 rounded border border-slate-200 inline-flex items-center gap-1 font-heading">
                                  <User size={11} /> Person
                                </span>
                              )}
                            </td>

                            {/* Grand Total */}
                            <td className="text-right">
                              <span className="font-bold text-xs text-black font-heading">
                                {(c.total_purchased || 0).toFixed(2)} AED
                              </span>
                            </td>

                            {/* Total Paid */}
                            <td className="text-right">
                              <span className="font-bold text-xs text-emerald-700 font-heading">
                                {(c.total_paid || 0).toFixed(2)} AED
                              </span>
                            </td>

                            {/* Outstanding Due */}
                            <td className="text-right">
                              {c.due > 0 ? (
                                <div className="flex items-center justify-end gap-1.5">
                                  <span className="font-bold text-xs text-rose-700 font-heading">
                                    {c.due.toFixed(2)} AED
                                  </span>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      openQuickPayment(c);
                                    }}
                                    className="w-6 h-6 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center transition-all cursor-pointer shadow-2xs"
                                    title="Collect Due Payment"
                                  >
                                    <CreditCard size={11} />
                                  </button>
                                </div>
                              ) : (
                                <span className="text-emerald-700 text-xs font-bold font-heading">
                                  ✓ Clear
                                </span>
                              )}
                            </td>

                            {/* Document Expiry */}
                            <td>
                              {(() => {
                                const docs = c.documents || [];
                                if (docs.length === 0) {
                                  return <span className="text-muted-foreground text-[11px] italic">None</span>;
                                }
                                
                                const displayDocs = docs.slice(0, 2);
                                const hasMore = docs.length > 2;
                                
                                return (
                                  <div className="flex flex-wrap gap-1 items-center">
                                    {displayDocs.map((doc: any) => {
                                      const daysLeft = getDaysRemaining(doc.expiry_date);
                                      return (
                                        <span
                                          key={doc.id}
                                          className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold border ${
                                            daysLeft < 0 ? 'bg-rose-500/15 text-rose-500 border-rose-500/30' :
                                            daysLeft <= 7 ? 'bg-rose-500/20 text-rose-600 border-rose-500/40' :
                                            daysLeft <= 30 ? 'bg-amber-500/15 text-amber-600 border-amber-500/30' :
                                            'bg-emerald-500/15 text-emerald-600 border-emerald-500/30'
                                          }`}
                                          title={`${doc.document_type} - Expires ${doc.expiry_date}`}
                                        >
                                          {doc.document_type}: {daysLeft < 0 ? 'Expired' : `${daysLeft}d`}
                                        </span>
                                      );
                                    })}
                                    {hasMore && (
                                      <span className="text-[10px] font-bold text-muted-foreground">
                                        +{docs.length - 2}
                                      </span>
                                    )}
                                  </div>
                                );
                              })()}
                            </td>

                            {/* Orders */}
                            <td className="text-center font-bold text-xs text-foreground">
                              {c.sales_count}
                            </td>

                            {/* Actions */}
                            <td onClick={(e) => e.stopPropagation()}>
                              <div className="flex items-center justify-center gap-1.5">
                                {hasPermission('Sales.Create') && (
                                  <button
                                    title="Quick Bill / New Invoice"
                                    onClick={() => openQuickSale(c)}
                                    className="w-7 h-7 rounded-full bg-primary/10 hover:bg-primary text-primary hover:text-white flex items-center justify-center transition-all cursor-pointer shadow-2xs"
                                  >
                                    <ShoppingCart size={13} />
                                  </button>
                                )}
                                <button
                                  onClick={() => handleOpenDetail(c)}
                                  className="w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-black flex items-center justify-center transition-all cursor-pointer shadow-2xs"
                                  title="Customer Details & Documents"
                                >
                                  <History size={13} />
                                </button>
                                {hasPermission('Customer.Update') && (
                                  <button
                                    onClick={() => openEditCustomerModal(c)}
                                    className="w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-black flex items-center justify-center transition-all cursor-pointer shadow-2xs"
                                    title="Edit Profile"
                                  >
                                    <Pencil size={13} />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>        {/* CUSTOMER PROFILE DETAIL PANEL (Structured & Understandable Modal) */}
        {selectedCustomer && (
          <div className={`fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/70 backdrop-blur-xs overflow-y-auto animate-fade-in ${printSaleData ? 'print:hidden' : ''}`}>
            <div className="glass border border-border rounded-2xl shadow-2xl relative bg-card w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col my-4 animate-scale-in">
              
              {/* 1. MODAL HEADER BANNER */}
              <div className="p-5 border-b border-border bg-muted/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="font-bold text-foreground text-lg sm:text-xl m-0 flex items-center gap-2">
                      {selectedCustomer.customer_type === 'company' ? (
                        <Building2 size={20} className="text-primary shrink-0" />
                      ) : (
                        <User size={20} className="text-primary shrink-0" />
                      )}
                      <span>
                        {selectedCustomer.customer_type === 'company' && selectedCustomer.company_name
                          ? selectedCustomer.company_name
                          : selectedCustomer.name}
                      </span>
                    </h2>
                    
                    {/* Account Type Badge */}
                    {selectedCustomer.customer_type === 'company' ? (
                      <span className="bg-primary/10 text-primary text-[10px] font-bold px-2 py-0.5 rounded border border-primary/20 inline-flex items-center gap-1">
                        <Building2 size={11} /> Company Account
                      </span>
                    ) : (
                      <span className="bg-muted text-muted-foreground text-[10px] font-bold px-2 py-0.5 rounded border border-border inline-flex items-center gap-1">
                        <User size={11} /> Person
                      </span>
                    )}
                  </div>

                  {/* Direct Contact Bar */}
                  <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground pt-1">
                    {selectedCustomer.phone && (
                      <div className="flex items-center gap-1.5">
                        <Phone size={12} className="text-primary" />
                        <span className="font-medium text-foreground">{selectedCustomer.phone}</span>
                        <a
                          href={`https://wa.me/${selectedCustomer.phone.replace(/\D/g, '')}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold hover:underline"
                        >
                          WhatsApp
                        </a>
                      </div>
                    )}
                    {selectedCustomer.email && (
                      <div className="flex items-center gap-1">
                        <Mail size={12} />
                        <span>{selectedCustomer.email}</span>
                      </div>
                    )}
                    {selectedCustomer.address && (
                      <div className="flex items-center gap-1">
                        <MapPin size={12} />
                        <span className="truncate max-w-[200px]">{selectedCustomer.address}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Top Actions & Close */}
                <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                  {hasPermission('Sales.Create') && (
                    <button
                      onClick={() => {
                        const targetId = selectedCustomer.id;
                        setSelectedCustomer(null);
                        navigate(`/sales/create?customer_id=${targetId}`);
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-primary hover:bg-primary-hover text-white text-xs rounded-xl font-bold shadow-xs transition-all cursor-pointer"
                    >
                      <ShoppingCart size={13} />
                      <span>New Invoice</span>
                    </button>
                  )}
                  {hasPermission('Customer.Update') && (
                    <button
                      onClick={() => openEditCustomerModal(selectedCustomer)}
                      className="p-2 border border-border bg-muted/40 hover:bg-secondary rounded-xl text-muted-foreground hover:text-foreground text-xs font-semibold transition-all cursor-pointer"
                      title="Edit Customer Profile"
                    >
                      <Pencil size={14} />
                    </button>
                  )}
                  <button
                    onClick={() => setSelectedCustomer(null)}
                    className="p-2 text-muted-foreground hover:text-foreground bg-muted/40 hover:bg-secondary rounded-xl transition-all cursor-pointer"
                    title="Close"
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>

              {/* 2. OVERVIEW KPI TILES */}
              {(() => {
                const totalBilling = (selectedCustomer.sales || []).reduce((sum: number, s: any) => sum + (s.grand_total || 0), 0);
                const outstandingDue = Number(selectedCustomer.due) || 0;
                const totalPaid = Math.max(0, totalBilling - outstandingDue);

                return (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 p-5 border-b border-border shrink-0 bg-background">
                    {/* Tile 1: Total Invoices & Billing */}
                    <div className="p-3.5 rounded-xl border border-border bg-muted/20 flex flex-col justify-between">
                      <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                        Total Billing
                      </div>
                      <div className="mt-1 flex items-center justify-between">
                        <div>
                          <div className="text-lg font-black text-foreground">
                            {totalBilling.toFixed(2)}{' '}
                            <span className="text-xs font-normal text-muted-foreground">AED</span>
                          </div>
                          <span className="text-[10px] text-muted-foreground font-semibold">
                            {(selectedCustomer.sales || []).length} invoice{(selectedCustomer.sales || []).length !== 1 ? 's' : ''}
                          </span>
                        </div>
                        <ReceiptText size={18} className="text-blue-500 opacity-70 shrink-0" />
                      </div>
                    </div>

                    {/* Tile 2: Total Paid (Collected) */}
                    <div className="p-3.5 rounded-xl border border-emerald-500/20 bg-emerald-500/5 flex flex-col justify-between">
                      <div className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
                        Total Paid
                      </div>
                      <div className="mt-1 flex items-center justify-between">
                        <div>
                          <div className="text-lg font-black text-emerald-600 dark:text-emerald-400">
                            {totalPaid.toFixed(2)}{' '}
                            <span className="text-xs font-normal">AED</span>
                          </div>
                          <span className="text-[10px] text-emerald-600/80 dark:text-emerald-400/80 font-semibold">
                            ✓ Collected
                          </span>
                        </div>
                        <CheckCircle2 size={18} className="text-emerald-500 shrink-0" />
                      </div>
                    </div>

                    {/* Tile 3: Outstanding Balance Due */}
                    <div className={`p-3.5 rounded-xl border flex flex-col justify-between ${outstandingDue > 0 ? 'border-rose-500/20 bg-rose-500/5' : 'border-border bg-muted/20'}`}>
                      <div className={`text-[11px] font-semibold uppercase tracking-wider ${outstandingDue > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-muted-foreground'}`}>
                        Outstanding Due
                      </div>
                      <div className="mt-1 flex items-center justify-between">
                        {outstandingDue > 0 ? (
                          <div>
                            <div className="text-lg font-black text-rose-600 dark:text-rose-400">
                              {outstandingDue.toFixed(2)} <span className="text-xs font-normal">AED</span>
                            </div>
                            <span className="text-[10px] font-semibold text-rose-500">Unpaid Balance</span>
                          </div>
                        ) : (
                          <div>
                            <div className="text-lg font-black text-emerald-600 dark:text-emerald-400">
                              0.00 <span className="text-xs font-normal">AED</span>
                            </div>
                            <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">✓ Account Clear</span>
                          </div>
                        )}
                        {outstandingDue > 0 && hasPermission('Payments.Create') && (
                          <button
                            onClick={() => {
                              const targetCust = selectedCustomer;
                              setSelectedCustomer(null);
                              openQuickPayment(targetCust);
                            }}
                            className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-bold rounded-lg shadow-xs transition-all cursor-pointer flex items-center gap-1 shrink-0"
                          >
                            <CreditCard size={12} />
                            <span>Pay</span>
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Tile 4: Tracked Visas & Docs */}
                    <div className="p-3.5 rounded-xl border border-border bg-muted/20 flex flex-col justify-between">
                      <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                        Tracked Documents
                      </div>
                      <div className="mt-1 flex items-center justify-between">
                        <div>
                          <div className="text-lg font-black text-foreground">
                            {selectedCustDocs.length}
                          </div>
                          <span className="text-[10px] text-muted-foreground font-semibold">
                            {selectedCustDocs.filter(d => getDaysRemaining(d.expiry_date) <= 30).length > 0 ? (
                              <span className="text-amber-500 font-bold">
                                ⚠️ {selectedCustDocs.filter(d => getDaysRemaining(d.expiry_date) <= 30).length} expiring soon
                              </span>
                            ) : (
                              'Active valid records'
                            )}
                          </span>
                        </div>
                        <Calendar size={18} className="text-primary opacity-60 shrink-0" />
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* 3. STRUCTURED NAVIGATION TABS */}
              <div className="flex items-center gap-2 px-5 pt-3 border-b border-border bg-muted/10 shrink-0">
                <button
                  type="button"
                  onClick={() => setCustDetailTab('invoices')}
                  className={`pb-2.5 px-2 text-xs font-bold transition-all border-b-2 cursor-pointer flex items-center gap-1.5 ${
                    custDetailTab === 'invoices'
                      ? 'border-primary text-primary'
                      : 'border-transparent text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <History size={14} />
                  <span>Invoices History</span>
                  <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-muted font-mono">
                    {(selectedCustomer.sales || []).length}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setCustDetailTab('documents')}
                  className={`pb-2.5 px-2 text-xs font-bold transition-all border-b-2 cursor-pointer flex items-center gap-1.5 ${
                    custDetailTab === 'documents'
                      ? 'border-primary text-primary'
                      : 'border-transparent text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Calendar size={14} />
                  <span>Visas & Documents</span>
                  <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-muted font-mono">
                    {selectedCustDocs.length}
                  </span>
                </button>

                {selectedCustomer.customer_type === 'company' && (
                  <button
                    type="button"
                    onClick={() => setCustDetailTab('members')}
                    className={`pb-2.5 px-2 text-xs font-bold transition-all border-b-2 cursor-pointer flex items-center gap-1.5 ${
                      custDetailTab === 'members'
                        ? 'border-primary text-primary'
                        : 'border-transparent text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <Users size={14} />
                    <span>People Under Company</span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-muted font-mono">
                      {(selectedCustomer.members || []).length}
                    </span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setCustDetailTab('info')}
                  className={`pb-2.5 px-2 text-xs font-bold transition-all border-b-2 cursor-pointer flex items-center gap-1.5 ${
                    custDetailTab === 'info'
                      ? 'border-primary text-primary'
                      : 'border-transparent text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <FileText size={14} />
                  <span>Profile Info & Notes</span>
                </button>
              </div>

              {/* 4. TAB CONTENTS AREA (Scrollable) */}
              <div className="flex-1 overflow-y-auto p-5 space-y-4">
                
                {/* TAB 1: INVOICES & LEDGER */}
                {custDetailTab === 'invoices' && (
                  <div className="space-y-3">
                    {(!selectedCustomer.sales || selectedCustomer.sales.length === 0) ? (
                      <div className="text-center text-xs text-muted-foreground py-8 bg-muted/20 rounded-xl border border-dashed border-border">
                        No invoices recorded for this customer yet.
                      </div>
                    ) : (
                      <div className="border border-border rounded-xl overflow-hidden shadow-xs">
                        <table className="w-full text-left">
                          <thead>
                            <tr>
                              <th>Invoice #</th>
                              <th>Date</th>
                              <th>Payment</th>
                              <th className="text-right">Total</th>
                              <th className="text-center w-28">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border/50">
                            {selectedCustomer.sales.map((s: any) => (
                              <tr key={s.id} className="hover:bg-primary/5">
                                <td>
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="font-mono font-bold text-xs tracking-tight text-foreground bg-muted/60 dark:bg-muted/40 px-2 py-0.5 rounded-md border border-border/80 inline-flex items-center gap-1 shadow-2xs">
                                      <ReceiptText size={12} className="text-primary opacity-80 shrink-0" />
                                      <span>#{s.invoice_no}</span>
                                    </span>
                                    {selectedCustomer.customer_type === 'company' && s.person_name && (
                                      <span className="text-[10px] bg-blue-500/10 text-blue-500 px-1.5 py-0.5 rounded-md font-semibold">
                                        {s.person_name}
                                      </span>
                                    )}
                                  </div>
                                </td>
                                <td className="text-xs text-muted-foreground">
                                  {new Date(s.created_at).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                                </td>
                                <td>
                                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold ${
                                    s.payment_status === 'Paid'
                                      ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25'
                                      : s.payment_status === 'Partially Paid'
                                      ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/25'
                                      : 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/25'
                                  }`}>
                                    {s.payment_status}
                                  </span>
                                </td>
                                <td className="text-right font-black text-xs text-foreground">
                                  {s.grand_total.toFixed(2)} <span className="text-[9px] font-normal text-muted-foreground">AED</span>
                                </td>
                                <td className="text-center">
                                  <div className="flex items-center justify-center gap-1">
                                    <button
                                      title="Print Invoice"
                                      onClick={() => handlePrintSale(s.id)}
                                      disabled={isPrinting}
                                      className="p-1.5 rounded-lg bg-primary/10 hover:bg-primary text-primary hover:text-white transition-all cursor-pointer disabled:opacity-50"
                                    >
                                      <Printer size={13} />
                                    </button>
                                    <button
                                      title="Send WhatsApp Receipt"
                                      onClick={async () => {
                                        const detail = await db.sales.getById(s.id);
                                        handleWhatsAppShare(detail);
                                      }}
                                      className="p-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500 text-emerald-600 dark:text-emerald-400 hover:text-white transition-all cursor-pointer"
                                    >
                                      <MessageSquare size={13} />
                                    </button>
                                    {hasPermission('Sales.Update') && (
                                      <button
                                        title="Edit Invoice Items"
                                        onClick={() => handleOpenEditItems(s.id)}
                                        className="p-1.5 rounded-lg bg-muted hover:bg-secondary text-muted-foreground hover:text-foreground transition-all cursor-pointer"
                                      >
                                        <Pencil size={13} />
                                      </button>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}

                {/* TAB 2: VISAS & DOCUMENTS */}
                {custDetailTab === 'documents' && (
                  <div className="space-y-3">
                    {selectedCustDocs.length === 0 ? (
                      <div className="text-center text-xs text-muted-foreground py-8 bg-muted/20 rounded-xl border border-dashed border-border">
                        No client documents or visas currently tracked for this profile.
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {selectedCustDocs.map(d => {
                          const daysLeft = getDaysRemaining(d.expiry_date);
                          const isExpired = daysLeft < 0;
                          const isUrgent = daysLeft >= 0 && daysLeft <= 30;

                          return (
                            <div
                              key={d.id}
                              className={`p-3.5 rounded-xl border transition-all flex flex-col justify-between text-xs ${
                                isExpired
                                  ? 'bg-rose-500/5 border-rose-500/30'
                                  : isUrgent
                                  ? 'bg-amber-500/5 border-amber-500/30'
                                  : 'bg-muted/20 border-border'
                              }`}
                            >
                              <div>
                                <div className="flex items-center justify-between font-bold">
                                  <span className="text-foreground text-sm">{d.document_type}</span>
                                  <span
                                    className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                                      isExpired
                                        ? 'bg-rose-500/20 text-rose-600 border-rose-500/30'
                                        : isUrgent
                                        ? 'bg-amber-500/20 text-amber-600 border-amber-500/30'
                                        : 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30'
                                    }`}
                                  >
                                    {isExpired ? 'Expired' : `${daysLeft} days left`}
                                  </span>
                                </div>

                                {d.document_number && (
                                  <div className="font-mono text-[11px] text-muted-foreground mt-1">
                                    Doc #: {d.document_number}
                                  </div>
                                )}

                                <div className="mt-2 text-xs flex items-center justify-between text-muted-foreground">
                                  <span>Expires on:</span>
                                  <span className="font-bold text-foreground">
                                    {new Date(d.expiry_date).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                                  </span>
                                </div>

                                {d.notes && (
                                  <div className="mt-2 text-[11px] bg-muted/40 p-2 rounded-lg text-foreground border border-border/40 italic">
                                    "{d.notes}"
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* TAB 3: PEOPLE UNDER COMPANY */}
                {custDetailTab === 'members' && selectedCustomer.customer_type === 'company' && (
                  <div className="space-y-3">
                    {(!selectedCustomer.members || selectedCustomer.members.length === 0) ? (
                      <div className="text-center text-xs text-muted-foreground py-8 bg-muted/20 rounded-xl border border-dashed border-border">
                        No people added under this company yet. Click Edit to add contacts or staff.
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {selectedCustomer.members.map((member: any) => (
                          <div
                            key={member.id}
                            className="p-3.5 rounded-xl border border-border bg-muted/20 flex flex-col justify-between text-xs space-y-2"
                          >
                            <div>
                              <div className="font-bold text-foreground text-sm flex items-center gap-1.5">
                                <User size={14} className="text-primary" />
                                <span>{member.name}</span>
                              </div>
                              <div className="text-[11px] text-muted-foreground mt-1 space-y-0.5">
                                {member.phone && <div>📞 {member.phone}</div>}
                                {member.email && <div>✉️ {member.email}</div>}
                              </div>
                            </div>
                            <div className="pt-2 border-t border-border/60 flex justify-end">
                              <button
                                type="button"
                                onClick={() => {
                                  const cust = selectedCustomer;
                                  setSelectedCustomer(null);
                                  openQuickSale(cust, member.name);
                                }}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 hover:bg-primary text-primary hover:text-white rounded-lg font-bold text-[11px] transition-all cursor-pointer shadow-xs"
                                title="Create invoice for this person"
                              >
                                <ShoppingCart size={12} />
                                <span>Create Invoice for {member.name}</span>
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* TAB 4: PROFILE INFO & NOTES */}
                {custDetailTab === 'info' && (
                  <div className="space-y-4 text-xs">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="p-3.5 rounded-xl border border-border bg-muted/20 space-y-1">
                        <div className="text-muted-foreground font-semibold flex items-center gap-1">
                          <MapPin size={13} className="text-primary" /> Billing Address
                        </div>
                        <div className="text-foreground font-medium pt-1">
                          {selectedCustomer.address || 'No billing address specified.'}
                        </div>
                      </div>

                      <div className="p-3.5 rounded-xl border border-border bg-muted/20 space-y-1">
                        <div className="text-muted-foreground font-semibold flex items-center gap-1">
                          <FileText size={13} className="text-primary" /> Administrative Notes
                        </div>
                        <div className="text-foreground italic pt-1">
                          {selectedCustomer.notes || 'No administrative notes recorded.'}
                        </div>
                      </div>
                    </div>

                    {/* Danger Zone: Delete */}
                    {hasPermission('Customer.Delete') && (
                      <div className="p-4 rounded-xl border border-destructive/20 bg-destructive/5 flex items-center justify-between">
                        <div>
                          <div className="font-bold text-destructive text-xs">Delete Customer Profile</div>
                          <div className="text-[11px] text-muted-foreground mt-0.5">
                            Soft-deletes this customer account. Existing invoice history is preserved.
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleDelete(selectedCustomer.id)}
                          className="px-3 py-1.5 bg-destructive hover:bg-destructive/90 text-white rounded-lg text-xs font-bold transition-all cursor-pointer shrink-0"
                        >
                          Delete Profile
                        </button>
                      </div>
                    )}
                  </div>
                )}

              </div>

            </div>
          </div>
      )}

      {/* QUICK SALE MODAL (SEARCH-WISE FAST BILLING) */}
      {qsCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/75 backdrop-blur-md print:hidden overflow-hidden">
          <div className="bg-card border border-border rounded-2xl shadow-2xl relative w-full max-w-6xl h-[92vh] max-h-[880px] overflow-hidden flex flex-col my-auto animate-in fade-in zoom-in-95 duration-150">

            {/* TOP HEADER */}
            <div className="flex items-center justify-between px-6 py-3.5 border-b border-border bg-muted/30 flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-xl text-primary flex items-center justify-center border border-primary/20">
                  <ReceiptText size={18} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black uppercase tracking-wider text-primary px-2 py-0.5 rounded bg-primary/10 border border-primary/20">
                      Quick Invoice
                    </span>
                    <span className="font-bold text-foreground text-sm flex items-center gap-1.5">
                      {qsCustomer.customer_type === 'company' ? <Building2 size={15} className="text-blue-500" /> : <User size={15} className="text-emerald-500" />}
                      <span>{qsCustomer.name}</span>
                    </span>
                    {qsCustomer.phone && (
                      <span className="text-xs text-muted-foreground font-mono">({qsCustomer.phone})</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Active Member Selection if Company */}
              {qsCustomer.customer_type === 'company' && qsCustomer.members && qsCustomer.members.length > 0 && (
                <div className="hidden sm:flex items-center gap-2 bg-card px-3 py-1.5 rounded-xl border border-border shadow-2xs">
                  <span className="text-[11px] font-bold text-muted-foreground flex items-center gap-1">
                    <Users size={13} className="text-primary" /> Active Person:
                  </span>
                  <select
                    value={qsPersonName}
                    onChange={(e) => setQsPersonName(e.target.value)}
                    className="text-xs font-bold text-foreground bg-muted/40 border border-border rounded-lg px-2 py-1 outline-none cursor-pointer"
                  >
                    <option value="">🏢 Entire Company (General)</option>
                    {qsCustomer.members.map((m: any) => (
                      <option key={m.id || m.name} value={m.name}>
                        👤 {m.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <button
                type="button"
                onClick={() => setQsCustomer(null)}
                className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted/80 rounded-lg transition-colors cursor-pointer"
                title="Close (Esc)"
              >
                <X size={18} />
              </button>
            </div>

            {/* MAIN 2-COLUMN WORKSPACE */}
            <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">

              {/* LEFT COLUMN: SEARCH SERVICES & LINE ITEMS (65% width) */}
              <div className="w-full lg:w-8/12 flex flex-col border-r border-border/60 overflow-hidden bg-muted/5 p-4 sm:p-5 space-y-3">
                
                {/* SEARCH-WISE SERVICE SELECTOR */}
                <div ref={qsSearchContainerRef} className="space-y-2 flex-shrink-0">
                  <div className="flex gap-2 relative">
                    <div className="relative flex-1">
                      <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                      <input
                        ref={qsSearchInputRef}
                        type="text"
                        value={qsSearch}
                        onFocus={() => setQsIsSearchOpen(true)}
                        onChange={e => {
                          setQsSearch(e.target.value);
                          setQsIsSearchOpen(true);
                          setQsHighlightIndex(0);
                        }}
                        onKeyDown={handleQsSearchKeyDown}
                        placeholder="Search typing, visa, or document services..."
                        className="w-full pl-10 pr-8 py-2.5 bg-background border-2 border-border focus:border-primary rounded-xl text-xs font-medium text-foreground placeholder:text-muted-foreground shadow-xs outline-none transition-all"
                      />
                      {qsSearch && (
                        <button
                          type="button"
                          onClick={() => {
                            setQsSearch('');
                            qsSearchInputRef.current?.focus();
                          }}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground text-xs p-1"
                        >
                          <X size={13} />
                        </button>
                      )}
                    </div>

                    {/* Category Filter Dropdown */}
                    <select
                      value={qsCategory}
                      onChange={e => setQsCategory(e.target.value)}
                      className="px-3 py-2 bg-muted/40 border border-border rounded-xl text-xs font-semibold text-foreground cursor-pointer shrink-0 max-w-[150px]"
                    >
                      <option value="all">All Categories ({qsServices.length})</option>
                      {qsCategories.map(cat => {
                        const count = qsServices.filter(s => s.category_id === cat.id).length;
                        if (count === 0) return null;
                        return (
                          <option key={cat.id} value={cat.id}>
                            {cat.name} ({count})
                          </option>
                        );
                      })}
                    </select>

                    {/* SEARCH RESULTS DROPDOWN (Directly under search bar) */}
                    {qsIsSearchOpen && (
                      <div className="absolute z-50 left-0 right-0 top-full mt-1 bg-card/95 backdrop-blur-xl border border-border rounded-2xl shadow-2xl overflow-hidden max-h-72 overflow-y-auto">
                        {qsFilteredServices.length > 0 ? (
                          <div className="divide-y divide-border/60">
                            <div className="px-3.5 py-1.5 bg-muted/50 text-[11px] font-semibold text-muted-foreground flex justify-between items-center">
                              <span>{qsFilteredServices.length} matching services</span>
                              <span className="text-[10px]">Use ↑↓ to navigate • ↵ Enter to add</span>
                            </div>
                            {qsFilteredServices.map((service, idx) => {
                              const inCartItems = qsCart.filter(i => i.service.id === service.id && i.person_name === (qsPersonName || undefined));
                              const inCartQty = inCartItems.reduce((sum, i) => sum + i.quantity, 0);
                              const isHighlighted = idx === qsHighlightIndex;
                              const catName = qsCategories.find(c => c.id === service.category_id)?.name || (service as any).category?.name || '';

                              return (
                                <div
                                  key={service.id}
                                  onMouseEnter={() => setQsHighlightIndex(idx)}
                                  onClick={() => {
                                    qsAddService(service);
                                    setQsSearch('');
                                    setQsIsSearchOpen(false);
                                    qsSearchInputRef.current?.focus();
                                  }}
                                  className={`px-4 py-2.5 flex items-center justify-between gap-3 cursor-pointer transition-colors ${
                                    isHighlighted ? 'bg-primary/10' : 'hover:bg-muted/50'
                                  }`}
                                >
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-0.5">
                                      <span className="font-bold text-xs text-foreground truncate">{service.name}</span>
                                      {catName && (
                                        <span className="px-2 py-0.2 rounded-full text-[10px] font-semibold bg-muted text-muted-foreground border border-border shrink-0">
                                          {catName}
                                        </span>
                                      )}
                                      {inCartQty > 0 && (
                                        <span className="px-2 py-0.2 rounded-full text-[10px] font-black bg-primary/15 text-primary border border-primary/30 shrink-0">
                                          {inCartQty} in bill
                                        </span>
                                      )}
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-2.5 shrink-0">
                                    <div className="text-right">
                                      <span className="font-extrabold text-foreground text-xs">{service.price.toFixed(2)}</span>
                                      <span className="text-[10px] text-muted-foreground font-medium ml-1">AED</span>
                                    </div>
                                    <button
                                      type="button"
                                      className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer ${
                                        isHighlighted || inCartQty > 0
                                          ? 'bg-primary text-white shadow-xs'
                                          : 'bg-muted/70 text-foreground hover:bg-primary hover:text-white'
                                      }`}
                                    >
                                      <Plus size={12} />
                                      <span>Add</span>
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="p-5 text-center text-muted-foreground text-xs">
                            <div className="mb-1 text-sm font-semibold text-foreground">No services found</div>
                            <div>No service matches "<span className="text-primary font-bold">{qsSearch}</span>". Try another keyword.</div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* QUICK ADD FREQUENT CHIPS */}
                  {!qsSearch && qsServices.length > 0 && (
                    <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                      <span className="text-[11px] font-bold text-muted-foreground mr-1">
                        Quick Add:
                      </span>
                      {qsServices.slice(0, 5).map(service => {
                        const inCart = qsCart.some(i => i.service.id === service.id);
                        return (
                          <button
                            key={service.id}
                            type="button"
                            onClick={() => qsAddService(service)}
                            className={`text-xs px-2.5 py-1 rounded-lg border font-medium transition-all flex items-center gap-1.5 cursor-pointer ${
                              inCart
                                ? 'border-primary/40 bg-primary/10 text-primary font-semibold'
                                : 'border-border bg-card hover:bg-muted hover:border-primary/40 text-foreground'
                            }`}
                          >
                            <span>{service.name}</span>
                            <span className="text-[10px] opacity-75 font-bold">({service.price.toFixed(0)} AED)</span>
                            <Plus size={11} className="text-primary" />
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* LINE ITEMS TABLE */}
                <div className="flex-1 border border-border/80 rounded-xl overflow-hidden bg-card flex flex-col shadow-2xs">
                  <div className="overflow-y-auto flex-1">
                    <table className="w-full text-left">
                      <thead className="bg-muted/40 text-muted-foreground uppercase text-[10px] font-bold sticky top-0 z-10 border-b border-border">
                        <tr>
                          <th className="w-8 text-center py-2.5">#</th>
                          <th className="py-2.5 pl-2">Service Details</th>
                          {qsCustomer.customer_type === 'company' && qsCustomer.members && qsCustomer.members.length > 0 && (
                            <th className="py-2.5 w-40">Member / Person</th>
                          )}
                          <th className="py-2.5 w-36">Note / Ref</th>
                          <th className="text-center w-28 py-2.5">Quantity</th>
                          <th className="w-24 text-center py-2.5">Unit Price</th>
                          <th className="text-right w-24 py-2.5 pr-3">Subtotal</th>
                          <th className="text-center w-8 py-2.5"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/50">
                        {qsCart.length === 0 ? (
                          <tr>
                            <td colSpan={qsCustomer.customer_type === 'company' && qsCustomer.members && qsCustomer.members.length > 0 ? 8 : 7} className="py-14 text-center text-muted-foreground italic">
                              <div className="max-w-xs mx-auto space-y-2">
                                <div className="p-3 rounded-full bg-muted/60 w-fit mx-auto text-muted-foreground">
                                  <Search size={22} />
                                </div>
                                <div className="text-xs font-semibold text-foreground">No services in invoice yet</div>
                                <div className="text-[11px] text-muted-foreground">Use the search bar above or Quick Add tags to add services.</div>
                              </div>
                            </td>
                          </tr>
                        ) : (
                          qsCart.map((item, idx) => (
                            <tr key={`${item.service.id}-${item.person_name || 'gen'}-${idx}`} className="hover:bg-primary/5 transition-colors">
                              <td className="text-center font-bold text-xs text-muted-foreground py-2.5">
                                {idx + 1}
                              </td>
                              <td className="py-2.5 pl-2">
                                <div className="font-bold text-foreground text-xs">{item.service.name}</div>
                                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                  <span className="text-[10px] text-muted-foreground">
                                    Standard: {item.service.price.toFixed(2)} AED
                                  </span>
                                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-primary/10 text-primary font-semibold border border-primary/20">
                                    Staff: {user?.name || 'Staff'}
                                  </span>
                                </div>
                              </td>
                              {qsCustomer.customer_type === 'company' && qsCustomer.members && qsCustomer.members.length > 0 && (
                                <td className="py-2.5">
                                  <select
                                    value={item.person_name || ''}
                                    onChange={e => {
                                      const updated = [...qsCart];
                                      updated[idx].person_name = e.target.value || undefined;
                                      setQsCart(updated);
                                    }}
                                    className="w-full text-xs font-semibold bg-muted/50 border border-border rounded-lg px-2.5 py-1.5 text-foreground cursor-pointer outline-none"
                                  >
                                    <option value="">🏢 General Company</option>
                                    {qsCustomer.members.map((m: any) => (
                                      <option key={m.id || m.name} value={m.name}>
                                        👤 {m.name}
                                      </option>
                                    ))}
                                  </select>
                                </td>
                              )}
                              <td className="py-2.5">
                                <input
                                  type="text"
                                  placeholder="Note / Ref..."
                                  value={item.notes || ''}
                                  onChange={e => {
                                    const updated = [...qsCart];
                                    updated[idx].notes = e.target.value;
                                    setQsCart(updated);
                                  }}
                                  className="w-full text-xs bg-muted/50 border border-border rounded-lg px-2.5 py-1.5 text-foreground placeholder:text-muted-foreground outline-none"
                                />
                              </td>
                              <td className="text-center py-2.5">
                                <div className="flex items-center justify-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => qsUpdateQty(idx, -1)}
                                    className="w-6 h-6 rounded border border-border bg-muted/50 flex items-center justify-center hover:bg-secondary text-foreground transition-colors cursor-pointer"
                                  >
                                    <Minus size={11} />
                                  </button>
                                  <span className="font-bold text-xs w-6 text-center text-foreground">{item.quantity}</span>
                                  <button
                                    type="button"
                                    onClick={() => qsUpdateQty(idx, 1)}
                                    className="w-6 h-6 rounded border border-border bg-muted/50 flex items-center justify-center hover:bg-secondary text-foreground transition-colors cursor-pointer"
                                  >
                                    <Plus size={11} />
                                  </button>
                                </div>
                              </td>
                              <td className="text-center py-2.5">
                                <input
                                  type="number"
                                  min={0}
                                  value={item.unit_price}
                                  onChange={e => qsUpdatePriceOverride(idx, parseFloat(e.target.value) || 0)}
                                  className="w-18 px-2 py-1 bg-muted/50 border border-border rounded-lg text-center text-xs font-bold text-foreground outline-none"
                                />
                              </td>
                              <td className="text-right font-black text-foreground text-xs py-2.5 pr-3">
                                {(item.unit_price * item.quantity).toFixed(2)} <span className="text-[10px] font-normal text-muted-foreground">AED</span>
                              </td>
                              <td className="text-center py-2.5">
                                <button
                                  type="button"
                                  onClick={() => qsUpdateQty(idx, -item.quantity)}
                                  className="text-muted-foreground hover:text-destructive p-1 rounded transition-colors cursor-pointer"
                                  title="Remove item"
                                >
                                  <Trash2 size={13} />
                                </button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

              </div>

              {/* RIGHT COLUMN: INVOICE TOTALS & 1-CLICK CHECKOUT (35% width) */}
              <div className="w-full lg:w-4/12 flex flex-col overflow-hidden bg-card">
                
                {/* Cart Header */}
                <div className="px-5 py-3 border-b border-border flex items-center justify-between bg-muted/20 flex-shrink-0">
                  <div className="flex items-center gap-2">
                    <ReceiptText size={15} className="text-primary" />
                    <span className="font-bold text-xs text-foreground">Checkout Summary</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-primary text-white">
                      {qsCart.reduce((sum, i) => sum + i.quantity, 0)} items
                    </span>
                  </div>
                  {qsCart.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setQsCart([])}
                      className="text-[11px] text-muted-foreground hover:text-destructive font-semibold transition-colors cursor-pointer"
                    >
                      Clear All
                    </button>
                  )}
                </div>

                {/* Remarks & Notes */}
                <div className="p-4 space-y-1.5 flex-shrink-0 border-b border-border/60">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Invoice Notes / Remarks</label>
                  <input
                    type="text"
                    value={qsNotes}
                    onChange={e => setQsNotes(e.target.value)}
                    placeholder="Optional remarks (e.g. expedited, passport received)..."
                    className="w-full px-3 py-2 bg-muted/30 border border-border rounded-xl text-xs font-medium text-foreground outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>

                {/* Member-Wise Breakdown Preview */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                      {qsMemberGroups.length > 1 ? `Invoices Preview (${qsMemberGroups.length})` : 'Line Items'}
                    </span>
                  </div>

                  {qsCart.length === 0 ? (
                    <div className="py-8 text-center text-muted-foreground text-xs italic">
                      No items added yet.
                    </div>
                  ) : (
                    qsMemberGroups.map((group, gIdx) => (
                      <div key={gIdx} className="p-3 rounded-xl border border-border bg-muted/10 space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold text-foreground">👤 {group.displayName}</span>
                          <span className="font-extrabold text-primary">{group.subtotal.toFixed(2)} AED</span>
                        </div>
                        <div className="space-y-1 pl-2 text-[11px] text-muted-foreground">
                          {group.items.map((it, itIdx) => (
                            <div key={itIdx} className="flex justify-between">
                              <span className="truncate pr-2">• {it.service.name} (x{it.quantity})</span>
                              <span className="font-mono shrink-0">{(it.unit_price * it.quantity).toFixed(2)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* BOTTOM SUMMARY & SUBMIT */}
                <div className="border-t border-border p-5 bg-muted/20 space-y-3 flex-shrink-0">
                  
                  {/* Subtotal and Discount */}
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between items-center text-muted-foreground font-medium">
                      <span>Subtotal</span>
                      <span className="font-bold text-foreground">{qsSubtotal.toFixed(2)} AED</span>
                    </div>

                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground font-medium flex items-center gap-1">
                        <Percent size={11} /> Discount
                      </span>
                      <div className="relative w-28">
                        <input
                          type="number"
                          min={0}
                          max={qsSubtotal}
                          value={qsDiscount || ''}
                          onChange={e => setQsDiscount(Math.max(0, parseFloat(e.target.value) || 0))}
                          placeholder="0"
                          className="w-full px-2.5 py-1 text-right bg-card border border-border rounded-lg text-foreground font-bold text-xs pr-8 outline-none"
                        />
                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground font-semibold">AED</span>
                      </div>
                    </div>

                    <div className="pt-2.5 border-t border-border flex justify-between items-baseline">
                      <span className="text-xs font-bold text-foreground">Grand Total</span>
                      <span className="text-xl font-black text-primary">
                        {qsGrandTotal.toFixed(2)} <span className="text-xs font-bold">AED</span>
                      </span>
                    </div>
                  </div>

                  {qsError && (
                    <div className="text-destructive text-xs bg-destructive/10 border border-destructive/20 rounded-lg p-2 font-semibold">
                      {qsError}
                    </div>
                  )}

                  {/* ACTION SUBMIT BUTTON */}
                  <button
                    type="button"
                    onClick={qsSubmit}
                    disabled={qsSaving || qsCart.length === 0}
                    className="w-full bg-primary hover:bg-primary-hover disabled:opacity-50 text-white py-3 rounded-xl font-bold text-xs sm:text-sm shadow-md shadow-primary/25 flex items-center justify-center gap-2 transition-all cursor-pointer mt-2"
                  >
                    {qsSaving ? (
                      <>
                        <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span>Generating Invoices...</span>
                      </>
                    ) : qsMemberGroups.length > 1 ? (
                      <>
                        <Printer size={15} />
                        <span>Generate {qsMemberGroups.length} Separate Invoices</span>
                      </>
                    ) : (
                      <>
                        <Printer size={15} />
                        <span>Finalize Sale & Generate Invoice</span>
                      </>
                    )}
                  </button>

                </div>

              </div>

            </div>

          </div>
        </div>
      )}

      {/* QUICK SALE ADVANCE PAYMENT MODAL */}
      {qsShowAdvanceModal && (
        <div className="fixed inset-0 z-60 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-200">
            
            {/* Modal Header */}
            <div className="p-5 border-b border-border bg-muted/20 flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                  <Coins size={22} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-foreground">
                    Any Advance / Down Payment Received?
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {qsAdvanceEntries.length > 1
                      ? `${qsAdvanceEntries.length} Invoices generated. Record advance payments per member or skip.`
                      : 'Invoice generated successfully. Record advance payment with note, or skip.'}
                  </p>
                </div>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-5 overflow-y-auto space-y-3.5 flex-1">
              {qsAdvanceEntries.map((entry, idx) => (
                <div key={entry.saleId} className="p-4 rounded-xl border border-border bg-muted/10 space-y-3">
                  
                  {/* Title */}
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-xs px-2 py-0.5 rounded bg-background border border-border text-foreground">
                        #{entry.invoiceNo}
                      </span>
                      <span className="font-bold text-xs text-foreground">
                        👤 {entry.memberName}
                      </span>
                    </div>
                    <div className="text-xs font-semibold text-muted-foreground">
                      Total Due: <strong className="text-foreground">{entry.grandTotal.toFixed(2)} AED</strong>
                    </div>
                  </div>

                  {/* Payment Inputs Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 pt-1">
                    
                    {/* Amount */}
                    <div className="sm:col-span-4 space-y-1">
                      <div className="flex items-center justify-between">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                          Advance Paid (AED)
                        </label>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              const updated = [...qsAdvanceEntries];
                              updated[idx].amount = entry.grandTotal;
                              setQsAdvanceEntries(updated);
                            }}
                            className="text-[9px] font-bold text-primary hover:underline cursor-pointer"
                          >
                            Full
                          </button>
                          <span className="text-[9px] text-muted-foreground">|</span>
                          <button
                            type="button"
                            onClick={() => {
                              const updated = [...qsAdvanceEntries];
                              updated[idx].amount = 0;
                              setQsAdvanceEntries(updated);
                            }}
                            className="text-[9px] font-bold text-muted-foreground hover:text-foreground cursor-pointer"
                          >
                            0
                          </button>
                        </div>
                      </div>
                      <input
                        type="number"
                        min={0}
                        max={entry.grandTotal}
                        step={0.01}
                        placeholder="0.00"
                        value={entry.amount || ''}
                        onChange={(e) => {
                          const val = Math.min(entry.grandTotal, parseFloat(e.target.value) || 0);
                          const updated = [...qsAdvanceEntries];
                          updated[idx].amount = val;
                          setQsAdvanceEntries(updated);
                        }}
                        className="w-full px-3 py-2 bg-background border border-border rounded-lg text-xs font-bold text-foreground text-right"
                      />
                    </div>

                    {/* Method */}
                    <div className="sm:col-span-3 space-y-1">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                        Method
                      </label>
                      <select
                        value={entry.method}
                        onChange={(e) => {
                          const updated = [...qsAdvanceEntries];
                          updated[idx].method = e.target.value as any;
                          setQsAdvanceEntries(updated);
                        }}
                        className="w-full px-2.5 py-2 bg-background border border-border rounded-lg text-xs font-semibold text-foreground cursor-pointer"
                      >
                        <option value="Cash">Cash</option>
                        <option value="Card">Card</option>
                        <option value="Mobile Banking">Mobile Banking</option>
                        <option value="Bank Transfer">Bank Transfer</option>
                      </select>
                    </div>

                    {/* Note / Remarks */}
                    <div className="sm:col-span-5 space-y-1">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                        <FileText size={11} />
                        <span>Payment Note / Ref</span>
                      </label>
                      <input
                        type="text"
                        placeholder="Receipt ref, remarks..."
                        value={entry.notes}
                        onChange={(e) => {
                          const updated = [...qsAdvanceEntries];
                          updated[idx].notes = e.target.value;
                          setQsAdvanceEntries(updated);
                        }}
                        className="w-full px-3 py-2 bg-background border border-border rounded-lg text-xs font-medium text-foreground"
                      />
                    </div>

                  </div>
                </div>
              ))}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-border bg-muted/20 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={handleQsSkipAdvance}
                disabled={qsSavingAdvance}
                className="px-4 py-2.5 rounded-xl border border-border bg-card hover:bg-muted text-xs font-bold text-muted-foreground hover:text-foreground transition-all cursor-pointer"
              >
                Skip (No Advance)
              </button>

              <button
                type="button"
                onClick={handleQsSaveAdvance}
                disabled={qsSavingAdvance}
                className="px-5 py-2.5 rounded-xl bg-primary hover:bg-primary-hover text-white text-xs font-bold shadow-sm transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <Coins size={14} />
                <span>{qsSavingAdvance ? 'Saving Payments...' : 'Save Payment & Print'}</span>
              </button>
            </div>

          </div>
        </div>
      )}

      {/* QUICK PAYMENT MODAL */}
      {qpCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm print:hidden overflow-y-auto">
          <div className="glass border border-border w-full max-w-md rounded-2xl overflow-hidden shadow-2xl p-6 space-y-4 bg-background">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <CreditCard size={18} className="text-emerald-400" />
                <h3 className="font-bold text-foreground text-md">Quick Payment</h3>
              </div>
              <button onClick={() => setQpCustomer(null)} className="text-muted-foreground hover:text-foreground bg-muted/40 rounded-full p-1 transition-colors">
                <X size={16} />
              </button>
            </div>

            <div className="text-xs space-y-3">
              <div className="flex justify-between items-center bg-muted/20 p-2.5 rounded-xl border border-border/60">
                <div>
                  <span className="text-muted-foreground block text-[10px] uppercase font-bold tracking-wider">Customer</span>
                  <span className="font-bold text-foreground text-sm">{qpCustomer.name}</span>
                </div>
                <div className="text-right">
                  <span className="text-muted-foreground block text-[10px] uppercase font-bold tracking-wider">Outstanding Dues</span>
                  <span className="font-extrabold text-amber-500 text-sm">{qpCustomer.due.toFixed(2)} AED</span>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-muted-foreground font-semibold">Select Sales Invoice to Collect</label>
                <select
                  value={qpSelectedSaleId}
                  onChange={e => handleQpSelectedSaleChange(e.target.value)}
                  className="w-full px-3 py-2 bg-popover border border-border rounded-lg text-foreground text-xs focus:ring-2 focus:ring-primary/50 outline-none"
                >
                  {qpSales.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.invoice_no} (Remaining Due: {s.remaining.toFixed(2)} AED)
                    </option>
                  ))}
                </select>
              </div>

              {/* Member / Person Allocation */}
              {(() => {
                const currentSale = qpSales.find(s => s.id === qpSelectedSaleId);
                const items = currentSale?.items || [];
                const distinctMembers = Array.from(new Set(items.map((it: any) => it.person_name).filter(Boolean)));
                return (
                  <div className="space-y-1.5 bg-muted/20 p-2.5 rounded-lg border border-border">
                    <label className="text-[11px] font-bold text-foreground flex items-center justify-between">
                      <span>Payment For Member / Applicant</span>
                      <span className="text-[10px] font-normal text-muted-foreground">Optional</span>
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <select
                        value={qpPersonName}
                        onChange={(e) => {
                          const val = e.target.value;
                          setQpPersonName(val);
                          const matching = items.filter((it: any) => it.person_name === val);
                          const total = matching.reduce((s: number, it: any) => s + it.subtotal, 0);
                          if (total > 0 && total <= (currentSale?.remaining || 0)) {
                            setQpAmount(parseFloat(total.toFixed(2)));
                          }
                        }}
                        className="w-full px-2.5 py-1.5 bg-popover border border-border rounded-lg text-foreground text-xs focus:ring-1 focus:ring-primary outline-none cursor-pointer"
                      >
                        <option value="">Entire Invoice / All Members</option>
                        {distinctMembers.map((m: any, idx: number) => {
                          const itemTotal = items.filter((it: any) => it.person_name === m).reduce((s: number, it: any) => s + it.subtotal, 0);
                          return (
                            <option key={idx} value={m}>
                              👤 {m} ({itemTotal.toFixed(2)} AED)
                            </option>
                          );
                        })}
                      </select>
                      <input
                        type="text"
                        placeholder="Or custom member name"
                        value={qpPersonName}
                        onChange={e => setQpPersonName(e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-muted/50 border border-border rounded-lg text-foreground text-xs focus:ring-1 focus:ring-primary outline-none"
                      />
                    </div>
                  </div>
                );
              })()}

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-muted-foreground font-semibold">Payment Method</label>
                  <select
                    value={qpMethod}
                    onChange={e => setQpMethod(e.target.value as any)}
                    className="w-full px-3 py-2 bg-popover border border-border rounded-lg text-foreground text-xs focus:ring-2 focus:ring-primary/50 outline-none"
                  >
                    <option value="Cash">Cash</option>
                    <option value="Card">Card</option>
                    <option value="Mobile Banking">Mobile Banking</option>
                    <option value="Bank Transfer">Bank Transfer</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-muted-foreground font-semibold">Amount to Collect (AED)</label>
                  <input
                    type="number"
                    min={0.01}
                    max={qpSales.find(s => s.id === qpSelectedSaleId)?.remaining || 999999}
                    step={0.01}
                    value={qpAmount || ''}
                    onChange={e => setQpAmount(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 bg-muted/50 border border-border rounded-lg text-foreground text-xs focus:ring-2 focus:ring-primary/50 outline-none font-semibold text-right"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-muted-foreground font-semibold flex items-center gap-1">Transaction / Ref Number</label>
                <input
                  type="text"
                  placeholder="E.g. Bank reference, TxID"
                  value={qpTxNo}
                  onChange={e => setQpTxNo(e.target.value)}
                  className="w-full px-3 py-2 bg-muted/50 border border-border rounded-lg text-foreground text-xs focus:ring-2 focus:ring-primary/50 outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-muted-foreground font-semibold">Notes / Remarks</label>
                <input
                  type="text"
                  placeholder="Optional payment remarks..."
                  value={qpNotes}
                  onChange={e => setQpNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-muted/50 border border-border rounded-lg text-foreground text-xs focus:ring-2 focus:ring-primary/50 outline-none"
                />
              </div>

              {qpError && (
                <div className="text-destructive text-xs bg-destructive/10 border border-destructive/20 rounded-lg p-3 font-medium">
                  {qpError}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => setQpCustomer(null)}
                  className="px-4 py-2 border border-border rounded-lg text-xs font-semibold text-muted-foreground hover:text-foreground"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={qpSubmit}
                  disabled={qpSaving || qpAmount <= 0}
                  className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 shadow-md shadow-emerald-500/10"
                >
                  {qpSaving ? (
                    <>
                      <span className="inline-block w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Saving...
                    </>
                  ) : (
                    'Record Payment'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}


      {/* EDIT INVOICE ITEMS MODAL (Z-INDEX 60 overlaying details modal) */}
      {editItemsModalOpen && editingSaleId && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm print:hidden">
          <div className="glass border border-border rounded-2xl p-6 w-full max-w-xl bg-white shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => { setEditItemsModalOpen(false); setEditingSaleId(null); }}
              className="absolute right-4 top-4 p-2 text-muted-foreground hover:text-foreground bg-muted/40 rounded-full transition-colors cursor-pointer"
            >
              <X size={16} />
            </button>

            <div className="flex items-center gap-2 mb-5">
              <Pencil size={16} className="text-violet-500" />
              <div>
                <h3 className="text-sm font-bold text-foreground leading-none">Edit Invoice Items</h3>
                <span className="text-[10px] text-muted-foreground mt-1 block">Add or remove line items from this sale invoice</span>
              </div>
            </div>

            {/* Current Items */}
            <div className="border border-border rounded-xl overflow-hidden mb-5">
              <div className="bg-muted/40 px-3 py-2 text-[10px] font-bold text-muted-foreground uppercase tracking-wider border-b border-border">
                Current Items ({editingSaleItems.length})
              </div>
              {editingSaleItems.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-5">No items on this invoice.</p>
              ) : (
                <table className="w-full text-xs">
                  <thead className="bg-muted/20">
                    <tr>
                      <th className="px-3 py-2 text-left text-muted-foreground font-semibold">Service</th>
                      <th className="px-3 py-2 text-center text-muted-foreground font-semibold">Staff</th>
                      <th className="px-3 py-2 text-center text-muted-foreground font-semibold">Qty</th>
                      <th className="px-3 py-2 text-right text-muted-foreground font-semibold">Price</th>
                      <th className="px-3 py-2 text-right text-muted-foreground font-semibold">Total</th>
                      <th className="px-2 py-2 w-8"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {editingSaleItems.map((item: any) => (
                      <tr key={item.id} className="border-t border-border/40 text-foreground">
                        <td className="px-3 py-2 font-medium text-foreground">
                          <div>{item.service?.name || 'Service'}</div>
                          {item.person_name && (
                            <div className="text-[10px] text-muted-foreground italic">(For: {item.person_name})</div>
                          )}
                        </td>
                        <td className="px-3 py-2 text-center text-[11px] font-medium text-foreground">
                          <span className="px-2 py-0.5 rounded bg-muted/80 text-foreground font-semibold border border-border/60">
                            {item.staff?.name || editingSale?.employee?.name || user?.name || 'Staff'}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-center text-foreground">{item.quantity}</td>
                        <td className="px-3 py-2 text-right text-foreground">{item.unit_price.toFixed(2)}</td>
                        <td className="px-3 py-2 text-right font-bold text-foreground">{item.subtotal.toFixed(2)}</td>
                        <td className="px-2 py-2 text-center">
                          <button
                            onClick={() => handleRemoveItem(item.id)}
                            disabled={editSaving}
                            className="p-1 text-rose-400 hover:text-rose-600 hover:bg-rose-500/10 rounded transition-colors cursor-pointer"
                            title="Remove item"
                          >
                            <Trash2 size={12} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Add New Item */}
            <div className="border border-violet-500/20 bg-violet-500/5 rounded-xl p-4 space-y-3">
              <p className="text-[11px] font-bold text-violet-600 uppercase tracking-wider">Add New Item</p>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Service</label>
                <select
                  value={addServiceId}
                  onChange={(e) => {
                    const svc = allServices.find(s => s.id === e.target.value);
                    setAddServiceId(e.target.value);
                    if (svc) setAddPrice(svc.price);
                  }}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-card text-xs font-semibold text-foreground focus:ring-1 focus:ring-violet-500 cursor-pointer"
                >
                  <option value="">-- Select a Service --</option>
                  {allServices.map(s => (
                    <option key={s.id} value={s.id}>{s.name} — {s.price.toFixed(2)} AED</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Quantity</label>
                  <input
                    type="number"
                    min={1}
                    value={addQty}
                    onChange={(e) => setAddQty(parseInt(e.target.value) || 1)}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-card text-xs font-semibold text-foreground focus:ring-1 focus:ring-violet-500"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Unit Price (AED)</label>
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    value={addPrice}
                    onChange={(e) => setAddPrice(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-card text-xs font-semibold text-foreground focus:ring-1 focus:ring-violet-500"
                  />
                </div>
              </div>
              <div className="flex items-center justify-between pt-1">
                <span className="text-xs text-muted-foreground font-semibold">
                  Subtotal: <strong className="text-foreground">{(addQty * addPrice).toFixed(2)} AED</strong>
                </span>
                <button
                  onClick={handleAddItem}
                  disabled={editSaving || !addServiceId}
                  className="flex items-center gap-1.5 px-4 py-2 bg-violet-500 hover:bg-violet-600 text-white text-xs font-bold rounded-xl transition-all shadow-md disabled:opacity-50 cursor-pointer"
                >
                  <Plus size={13} />
                  Add to Invoice
                </button>
              </div>
            </div>

            <div className="flex justify-end pt-4 border-t border-border mt-4">
              <button
                onClick={() => { setEditItemsModalOpen(false); setEditingSaleId(null); }}
                className="px-4 py-2 bg-secondary hover:bg-muted text-foreground text-xs font-bold rounded-xl transition-all cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* REGISTER / EDIT CUSTOMER MODAL (Simple, Clean & Fast) */}
      {customerModalOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-3 sm:p-5 bg-black/70 backdrop-blur-xs animate-fade-in">
          <div className="glass border border-border rounded-2xl shadow-2xl relative bg-card w-full max-w-xl overflow-hidden flex flex-col max-h-[90vh] animate-scale-in">
            
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-border bg-muted/20 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-primary/10 text-primary">
                  {customerForm.customer_type === 'company' ? <Building2 size={18} /> : <User size={18} />}
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-foreground m-0">
                    {editingCustomerId ? 'Edit Customer Profile' : 'Register New Customer'}
                  </h3>
                  <p className="text-[11px] text-muted-foreground m-0">
                    {customerForm.customer_type === 'company' ? 'Company profile with employees/people' : 'Single person customer record'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setCustomerModalOpen(false)}
                className="p-1.5 text-muted-foreground hover:text-foreground bg-muted/40 hover:bg-secondary rounded-xl transition-all cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSaveCustomer} className="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1">
              
              {/* Account Type Toggle */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Account Type</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setCustomerForm(prev => ({ ...prev, customer_type: 'individual' }))}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                      customerForm.customer_type === 'individual'
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border bg-muted/20 text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <User size={14} />
                    <span>Person (Individual)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setCustomerForm(prev => ({ ...prev, customer_type: 'company' }))}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                      customerForm.customer_type === 'company'
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border bg-muted/20 text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <Building2 size={14} />
                    <span>Company</span>
                  </button>
                </div>
              </div>

              {/* Name & Phone */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                    {customerForm.customer_type === 'company' ? 'Company Name *' : 'Full Name *'}
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      required
                      value={customerForm.name}
                      onChange={(e) => setCustomerForm(prev => ({ ...prev, name: e.target.value }))}
                      placeholder={customerForm.customer_type === 'company' ? 'e.g. Al Hilal Contracting LLC' : 'e.g. Mohammed Salem'}
                      className="w-full pl-8 pr-3 py-2 bg-muted/30 border border-border rounded-xl text-xs font-semibold text-foreground focus:ring-2 focus:ring-primary/40 outline-none"
                    />
                    <div className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground">
                      {customerForm.customer_type === 'company' ? <Building2 size={13} /> : <User size={13} />}
                    </div>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                    {customerForm.customer_type === 'company' ? 'Company Phone / Landline' : 'Phone / WhatsApp'}
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={customerForm.phone}
                      onChange={(e) => setCustomerForm(prev => ({ ...prev, phone: e.target.value }))}
                      placeholder="+971 50 123 4567"
                      className="w-full pl-8 pr-3 py-2 bg-muted/30 border border-border rounded-xl text-xs font-semibold text-foreground focus:ring-2 focus:ring-primary/40 outline-none"
                    />
                    <div className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground">
                      <Phone size={13} />
                    </div>
                  </div>
                </div>
              </div>

              {/* Email & Location */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Email Address</label>
                  <div className="relative">
                    <input
                      type="email"
                      value={customerForm.email}
                      onChange={(e) => setCustomerForm(prev => ({ ...prev, email: e.target.value }))}
                      placeholder="info@company.ae"
                      className="w-full pl-8 pr-3 py-2 bg-muted/30 border border-border rounded-xl text-xs font-semibold text-foreground focus:ring-2 focus:ring-primary/40 outline-none"
                    />
                    <div className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground">
                      <Mail size={13} />
                    </div>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Office / Location Address</label>
                  <div className="relative">
                    <input
                      type="text"
                      value={customerForm.address}
                      onChange={(e) => setCustomerForm(prev => ({ ...prev, address: e.target.value }))}
                      placeholder="Musaffah M37, Abu Dhabi"
                      className="w-full pl-8 pr-3 py-2 bg-muted/30 border border-border rounded-xl text-xs font-semibold text-foreground focus:ring-2 focus:ring-primary/40 outline-none"
                    />
                    <div className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground">
                      <MapPin size={13} />
                    </div>
                  </div>
                </div>
              </div>

              {/* PEOPLE UNDER COMPANY (Only for Company Account) */}
              {customerForm.customer_type === 'company' && (
                <div className="space-y-3 p-4 rounded-xl border border-primary/20 bg-primary/5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Users size={15} className="text-primary" />
                      <span className="text-xs font-bold text-foreground">People Under This Company ({peopleUnderCompany.length})</span>
                    </div>
                    <span className="text-[10px] text-muted-foreground">Add staff / employees</span>
                  </div>

                  {/* List of Added People */}
                  {peopleUnderCompany.length > 0 ? (
                    <div className="space-y-1.5 max-h-36 overflow-y-auto">
                      {peopleUnderCompany.map((person, index) => (
                        <div
                          key={person.id || index}
                          className="flex items-center justify-between p-2 rounded-lg bg-card border border-border text-xs"
                        >
                          <div className="flex items-center gap-2 truncate">
                            <span className="font-bold text-foreground">{person.name}</span>
                            {person.phone && <span className="text-muted-foreground text-[11px]">• {person.phone}</span>}
                            {person.email && <span className="text-muted-foreground text-[11px] truncate">• {person.email}</span>}
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRemovePerson(index)}
                            className="text-destructive/70 hover:text-destructive p-1 rounded hover:bg-destructive/10 transition-colors cursor-pointer shrink-0"
                            title="Remove person"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[11px] text-muted-foreground italic text-center py-2 bg-card/60 rounded-lg border border-dashed border-border/80">
                      No people added under this company yet. Add below:
                    </p>
                  )}

                  {/* Add Person Inline Inputs */}
                  <div className="p-3 rounded-lg bg-card border border-border space-y-2">
                    <div className="text-[11px] font-bold text-foreground">Add Person / Contact:</div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <input
                        type="text"
                        placeholder="Person Name *"
                        value={newPersonName}
                        onChange={(e) => setNewPersonName(e.target.value)}
                        className="px-2.5 py-1.5 bg-muted/40 border border-border rounded-lg text-xs font-medium text-foreground focus:ring-1 focus:ring-primary outline-none"
                      />
                      <input
                        type="text"
                        placeholder="Phone / WhatsApp"
                        value={newPersonPhone}
                        onChange={(e) => setNewPersonPhone(e.target.value)}
                        className="px-2.5 py-1.5 bg-muted/40 border border-border rounded-lg text-xs font-medium text-foreground focus:ring-1 focus:ring-primary outline-none"
                      />
                      <input
                        type="email"
                        placeholder="Email"
                        value={newPersonEmail}
                        onChange={(e) => setNewPersonEmail(e.target.value)}
                        className="px-2.5 py-1.5 bg-muted/40 border border-border rounded-lg text-xs font-medium text-foreground focus:ring-1 focus:ring-primary outline-none"
                      />
                    </div>
                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={handleAddPerson}
                        disabled={!newPersonName.trim()}
                        className="flex items-center gap-1 px-3 py-1.5 bg-primary hover:bg-primary-hover disabled:opacity-50 text-white rounded-lg text-xs font-bold transition-all cursor-pointer"
                      >
                        <Plus size={13} />
                        <span>Add Person</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Notes */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Staff Notes / Remarks</label>
                <textarea
                  rows={2}
                  value={customerForm.notes}
                  onChange={(e) => setCustomerForm(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="Optional internal remarks..."
                  className="w-full px-3 py-2 bg-muted/30 border border-border rounded-xl text-xs font-medium text-foreground focus:ring-2 focus:ring-primary/40 outline-none resize-none"
                />
              </div>

              {customerModalError && (
                <div className="text-destructive text-xs bg-destructive/10 border border-destructive/20 rounded-xl p-3 font-medium">
                  {customerModalError}
                </div>
              )}

              {/* Modal Footer */}
              <div className="flex justify-end gap-2.5 pt-3 border-t border-border shrink-0">
                <button
                  type="button"
                  onClick={() => setCustomerModalOpen(false)}
                  className="px-4 py-2 border border-border rounded-xl text-xs font-bold text-muted-foreground hover:text-foreground transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={customerModalSaving}
                  className="px-5 py-2 bg-primary hover:bg-primary-hover disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-md shadow-primary/20 transition-all cursor-pointer flex items-center gap-2"
                >
                  {customerModalSaving ? (
                    <>
                      <span className="inline-block w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : editingCustomerId ? (
                    'Save Changes'
                  ) : (
                    'Register Customer'
                  )}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* HIDDEN PRINT-ONLY INVOICE — rendered when printSaleData is set */}
      {printSaleData && (() => {
        const allPayments = printSaleData.payments || [];
        const totalCollected = allPayments.filter((p: any) => p.amount > 0).reduce((s: number, p: any) => s + p.amount, 0);
        const totalRefunded = Math.abs(allPayments.filter((p: any) => p.amount < 0 || p.is_refund).reduce((s: number, p: any) => s + p.amount, 0));
        const netPaid = totalCollected - totalRefunded;
        const due = Math.max(0, printSaleData.grand_total - netPaid);

        return (
          <div className="hidden print:block fixed inset-0 bg-white p-6 sm:p-8 z-[9999] text-black text-xs font-sans print-invoice-sheet leading-normal">
            {/* 1. Brand Header */}
            <div className="flex items-center justify-between pb-2 border-b border-gray-300 gap-3">
              <img src="/logo.png" alt="AZIZI Logo" className="w-16 h-16 object-contain shrink-0" />
              <div className="text-center flex-1 space-y-0.5">
                <div className="text-lg font-black text-[#000ba0] tracking-wide" style={{ fontFamily: "'Cairo', 'Inter', sans-serif" }}>
                  مكتب عزيزي للكتابة وعمل الأختام ذ.م.م - فرع ۱
                </div>
                <div className="text-sm font-black text-[#f28f00] tracking-wider italic uppercase">
                  AZIZI TYPING &amp; STAMP MAKING BR. 1
                </div>
                <div className="text-xs text-black font-bold">
                  Mobile: 0542797933 • Email: azizitypingbr@gmail.com
                </div>
                <div className="text-[11px] text-gray-700 font-medium">
                  Abu Dhabi, Musaffah M37, Near Irani Masjid
                </div>
              </div>
              <div className="w-16 shrink-0" />
            </div>

            {/* 2. Blue Customer Invoice Banner */}
            <div className="bg-[#000ba0] text-white flex items-center justify-between px-3.5 py-1.5 font-bold uppercase tracking-wider text-xs my-2.5 rounded-xs">
              <span className="font-extrabold tracking-widest text-[12px]">CUSTOMER INVOICE</span>
              <span className="bg-[#f28f00] text-white px-3 py-0.5 rounded font-mono text-xs tracking-wider">
                # {printSaleData.invoice_no}
              </span>
            </div>

            {/* 3. Structured Invoice Info Grid Table */}
            <table className="w-full border-collapse border border-gray-300 text-xs my-2.5 bg-white text-black">
              <tbody>
                <tr>
                  <td className="bg-[#f28f00] text-white font-extrabold px-3 py-2 border border-gray-300 w-[22%] uppercase tracking-wider align-middle">
                    INVOICE TO
                  </td>
                  <td className="px-3 py-2 border border-gray-300 text-black w-[78%]" colSpan={3}>
                    {(() => {
                      if (!printSaleData.customer) return <span className="font-extrabold text-sm">Walk-in / Individual</span>;
                      const companyName = printSaleData.customer.customer_type === 'company' 
                        ? printSaleData.customer.name 
                        : (printSaleData.customer.company?.name || printSaleData.customer.name);
                      const companyPhone = printSaleData.customer.customer_type === 'company'
                        ? printSaleData.customer.phone
                        : (printSaleData.customer.company?.phone || printSaleData.customer.phone);
                      return (
                        <div className="flex flex-col">
                          <span className="font-black text-black text-[13px] uppercase">{companyName}</span>
                          <div className="flex items-center gap-4 text-[10px] text-gray-700 font-medium mt-0.5">
                            {companyPhone && (
                              <span><strong className="text-gray-900">Phone:</strong> {companyPhone}</span>
                            )}
                            {printSaleData.customer.trn && (
                              <span><strong className="text-gray-900">TRN:</strong> {printSaleData.customer.trn}</span>
                            )}
                          </div>
                        </div>
                      );
                    })()}
                  </td>
                </tr>
                <tr>
                  <td className="bg-gray-50 text-gray-800 font-bold px-3 py-1.5 border border-gray-300 w-[22%]">
                    Mr. / M/s:
                  </td>
                  <td className="px-3 py-1.5 border border-gray-300 text-black font-semibold w-[28%]">
                    {(() => {
                      const memberName = printSaleData.person_name 
                        || (printSaleData.customer?.customer_type !== 'company' ? printSaleData.customer?.name : '') 
                        || printSaleData.items?.[0]?.person_name 
                        || '—';
                      return (
                        <span className="font-bold text-black text-[12px]">{memberName}</span>
                      );
                    })()}
                  </td>
                  <td className="bg-[#f28f00] text-white font-extrabold px-3 py-1.5 border border-gray-300 w-[22%] uppercase tracking-wider text-center">
                    DATE
                  </td>
                  <td className="px-3 py-1.5 border border-gray-300 text-black font-bold text-center w-[28%]">
                    {new Date(printSaleData.created_at).toLocaleDateString()}
                  </td>
                </tr>
                <tr>
                  <td className="bg-gray-50 text-gray-800 font-bold px-3 py-1.5 border border-gray-300 w-[22%]">
                    Invoice No:
                  </td>
                  <td className="px-3 py-1.5 border border-gray-300 text-black font-bold font-mono w-[78%]" colSpan={3}>
                    {printSaleData.invoice_no}
                  </td>
                </tr>
              </tbody>
            </table>

            {/* 4. Line Items Table */}
            <div className="border border-gray-300 my-2.5">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-[#000ba0] text-white font-extrabold text-[11px]">
                    <th className="px-3 py-1.5 text-center border-r border-gray-300 w-10">SR#</th>
                    <th className="px-3 py-1.5 border-r border-gray-300">Description of Service</th>
                    <th className="px-3 py-1.5 text-center border-r border-gray-300 w-24">QTY</th>
                    <th className="px-3 py-1.5 text-right border-r border-gray-300 w-24">Price</th>
                    <th className="px-3 py-1.5 text-right border-r border-gray-300 w-20">Discount</th>
                    <th className="px-3 py-1.5 text-right w-24">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    const items = printSaleData.items || [];
                    const rows: React.ReactNode[] = [];

                    items.forEach((item: any, iIdx: number) => {
                      rows.push(
                        <tr key={item.id || iIdx} className="border-b border-gray-300 h-7 text-black">
                          <td className="px-3 py-1 text-center border-r border-gray-300 font-bold">{iIdx + 1}</td>
                          <td className="px-3 py-1 border-r border-gray-300 font-medium">
                            <span>{item.service?.name || 'Service'}</span>
                            {item.notes && <span className="text-[10px] text-gray-500 italic block">{item.notes}</span>}
                          </td>
                          <td className="px-3 py-1 text-center border-r border-gray-300 font-bold">{item.quantity}</td>
                          <td className="px-3 py-1 text-right border-r border-gray-300 font-mono">{item.unit_price.toFixed(2)}</td>
                          <td className="px-3 py-1 text-right border-r border-gray-300 font-mono">0.00</td>
                          <td className="px-3 py-1 text-right font-mono font-bold">{item.subtotal.toFixed(2)}</td>
                        </tr>
                      );
                    });

                    const emptyCount = Math.max(0, 5 - items.length);
                    for (let i = 0; i < emptyCount; i++) {
                      rows.push(
                        <tr key={`empty-${i}`} className="border-b border-gray-300 h-7">
                          <td className="px-3 py-1 text-center border-r border-gray-300 font-bold text-gray-400">{items.length + i + 1}</td>
                          <td className="px-3 py-1 border-r border-gray-300"></td>
                          <td className="px-3 py-1 border-r border-gray-300"></td>
                          <td className="px-3 py-1 border-r border-gray-300"></td>
                          <td className="px-3 py-1 border-r border-gray-300"></td>
                          <td className="px-3 py-1 text-right"></td>
                        </tr>
                      );
                    }

                    return rows;
                  })()}
                </tbody>
                <tfoot>
                  <tr className="bg-[#f28f00] text-white font-extrabold border-t border-gray-300 text-xs">
                    <td className="px-3 py-1.5 text-center border-r border-gray-300 uppercase tracking-wider" colSpan={5}>
                      Sub Total
                    </td>
                    <td className="px-3 py-1.5 text-right font-mono font-black">
                      {(printSaleData.subtotal || 0).toFixed(2)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* 5. Bottom Section: Remarks & Payment Record */}
            <div className="grid grid-cols-2 gap-3 my-2.5 items-stretch">
              <div className="border border-gray-300 rounded-xs flex flex-col bg-white text-xs">
                <div className="bg-gray-100 text-gray-800 font-bold px-3 py-1.5 border-b border-gray-300 text-[11px] uppercase tracking-wider">
                  Remarks &amp; Internal Notes
                </div>
                <div className="p-3 flex-1 flex items-start text-xs font-semibold text-black italic leading-relaxed">
                  {printSaleData.notes || ''}
                </div>
              </div>

              <div className="border border-gray-300 rounded-xs flex flex-col bg-white text-xs">
                <div className="bg-[#000ba0] text-white text-center py-1 font-extrabold uppercase tracking-wider text-xs">
                  PAYMENT ENTRY RECORD
                </div>
                <table className="w-full text-left border-collapse">
                  <thead className="bg-[#000ba0] text-white font-bold border-b border-gray-300 text-[11px]">
                    <tr>
                      <th className="px-2.5 py-1 border-r border-gray-300">Deposit Date</th>
                      <th className="px-2.5 py-1 border-r border-gray-300">Type</th>
                      <th className="px-2.5 py-1 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-300 text-black">
                    {(() => {
                      const payments = printSaleData.payments || [];
                      const rows: React.ReactNode[] = [];

                      payments.forEach((p: any, pIdx: number) => {
                        const isRef = p.is_refund || p.amount < 0;
                        rows.push(
                          <tr key={p.id || pIdx} className="h-6 text-xs">
                            <td className="px-2.5 py-1 border-r border-gray-300">
                              {new Date(p.payment_date || p.created_at).toLocaleDateString()}
                            </td>
                            <td className={`px-2.5 py-1 border-r border-gray-300 font-bold capitalize ${isRef ? 'text-rose-700' : ''}`}>
                              {isRef ? `↩ Refund (${p.payment_method})` : p.payment_method}
                            </td>
                            <td className={`px-2.5 py-1 text-right font-mono font-bold ${isRef ? 'text-rose-700' : ''}`}>
                              {isRef ? `-${Math.abs(p.amount).toFixed(2)}` : p.amount.toFixed(2)}
                            </td>
                          </tr>
                        );
                      });

                      const emptyPayCount = Math.max(0, 2 - payments.length);
                      for (let i = 0; i < emptyPayCount; i++) {
                        rows.push(
                          <tr key={`empty-pay-${i}`} className="h-6">
                            <td className="px-2.5 py-1 border-r border-gray-300"></td>
                            <td className="px-2.5 py-1 border-r border-gray-300"></td>
                            <td className="px-2.5 py-1 text-right"></td>
                          </tr>
                        );
                      }

                      return rows;
                    })()}
                  </tbody>
                </table>

                {/* Totals Summary */}
                <div className="divide-y divide-gray-300 border-t border-gray-300">
                  <div className="flex justify-between bg-[#000ba0] text-white font-extrabold px-3 py-1.5 text-xs">
                    <span>Total Amount</span>
                    <span className="font-mono">{(printSaleData.grand_total || 0).toFixed(2)} AED</span>
                  </div>
                  <div className="flex justify-between bg-white text-black font-extrabold px-3 py-1 text-xs">
                    <span>Paid Amount</span>
                    <span className="font-mono">{totalCollected.toFixed(2)} AED</span>
                  </div>
                  {totalRefunded > 0 && (
                    <div className="flex justify-between bg-rose-50 text-rose-800 font-extrabold px-3 py-1 text-xs">
                      <span>Less: Refunded</span>
                      <span className="font-mono">-{totalRefunded.toFixed(2)} AED</span>
                    </div>
                  )}
                  {totalRefunded > 0 && (
                    <div className="flex justify-between bg-slate-100 text-slate-900 font-extrabold px-3 py-1 text-xs">
                      <span>Net Paid</span>
                      <span className="font-mono">{netPaid.toFixed(2)} AED</span>
                    </div>
                  )}
                  <div className={`flex justify-between font-black px-3 py-1.5 text-xs ${
                    due > 0 ? 'bg-rose-50 text-rose-800' : 'bg-emerald-50 text-emerald-800'
                  }`}>
                    <span>Due Amount</span>
                    <span className="font-mono">{due.toFixed(2)} AED</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* 2. CUSTOMER DIRECTORY PDF / PRINT REPORT */}
      {isPrintingCustomerList && (
        <div className="hidden print:block fixed inset-0 bg-white text-black z-[99999] p-8 font-sans print-invoice-sheet">
          {/* Header */}
          <div className="flex items-center justify-between border-b-2 border-[#000ba0] pb-3 mb-3">
            <div className="flex items-center gap-3">
              <img src="/logo.png" alt="Azizi Logo" className="w-14 h-14 object-contain" />
              <div>
                <h1 className="text-lg font-black text-[#000ba0] tracking-tight">AZIZI TYPING &amp; STAMP MAKING</h1>
                <p className="text-[11px] text-gray-600 font-semibold">Musaffah M37, Abu Dhabi, UAE • Tel: 0542797933 • azizitypingbr@gmail.com</p>
              </div>
            </div>
            <div className="text-right">
              <div className="bg-[#f28f00] text-white px-3 py-1 rounded text-xs font-bold uppercase tracking-wider inline-block">
                Customer Directory Report
              </div>
              <div className="text-[10px] text-gray-500 mt-1 font-mono">Date: {new Date().toLocaleDateString()}</div>
            </div>
          </div>

          {/* Filter Note & Summary KPIs */}
          {(() => {
            const totalBilledAll = filteredCustomers.reduce((sum: number, c: any) => sum + (c.total_purchased || 0), 0);
            const totalPaidAll = filteredCustomers.reduce((sum: number, c: any) => sum + (c.total_paid || 0), 0);
            const totalDueAll = filteredCustomers.reduce((sum: number, c: any) => sum + (c.due || 0), 0);
            const totalOrdersAll = filteredCustomers.reduce((sum: number, c: any) => sum + (c.sales_count || 0), 0);

            return (
              <>
                <div className="grid grid-cols-4 gap-2 mb-3">
                  <div className="border border-gray-300 rounded p-2 bg-gray-50 text-center">
                    <div className="text-[9px] text-gray-500 font-bold uppercase">Total Customers</div>
                    <div className="text-sm font-black text-black">{filteredCustomers.length}</div>
                  </div>
                  <div className="border border-gray-300 rounded p-2 bg-gray-50 text-center">
                    <div className="text-[9px] text-gray-500 font-bold uppercase">Grand Total Billing</div>
                    <div className="text-sm font-black text-[#000ba0]">{totalBilledAll.toFixed(2)} AED</div>
                  </div>
                  <div className="border border-gray-300 rounded p-2 bg-gray-50 text-center">
                    <div className="text-[9px] text-gray-500 font-bold uppercase">Total Collected Paid</div>
                    <div className="text-sm font-black text-emerald-700">{totalPaidAll.toFixed(2)} AED</div>
                  </div>
                  <div className="border border-gray-300 rounded p-2 bg-gray-50 text-center">
                    <div className="text-[9px] text-gray-500 font-bold uppercase">Total Outstanding Due</div>
                    <div className="text-sm font-black text-rose-700">{totalDueAll.toFixed(2)} AED</div>
                  </div>
                </div>

                {/* Customer Table */}
                <table className="w-full border-collapse border border-gray-300 text-[11px] my-2">
                  <thead className="bg-[#000ba0] text-white font-bold">
                    <tr>
                      <th className="border border-gray-300 px-2 py-1.5 text-center w-7">#</th>
                      <th className="border border-gray-300 px-2 py-1.5 text-left">Customer Name</th>
                      <th className="border border-gray-300 px-2 py-1.5 text-left">Contact / Phone</th>
                      <th className="border border-gray-300 px-2 py-1.5 text-center">Type</th>
                      <th className="border border-gray-300 px-2 py-1.5 text-right">Grand Total</th>
                      <th className="border border-gray-300 px-2 py-1.5 text-right">Total Paid</th>
                      <th className="border border-gray-300 px-2 py-1.5 text-right">Outstanding Due</th>
                      <th className="border border-gray-300 px-2 py-1.5 text-center w-14">Orders</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-300">
                    {filteredCustomers.map((c: any, index: number) => (
                      <tr key={c.id} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                        <td className="border border-gray-300 px-2 py-1 text-center font-bold">{index + 1}</td>
                        <td className="border border-gray-300 px-2 py-1 font-bold text-black">{c.name}</td>
                        <td className="border border-gray-300 px-2 py-1 text-gray-700">{c.phone || c.email || 'N/A'}</td>
                        <td className="border border-gray-300 px-2 py-1 text-center uppercase text-[10px] font-semibold">{c.customer_type || 'individual'}</td>
                        <td className="border border-gray-300 px-2 py-1 text-right font-semibold">{(c.total_purchased || 0).toFixed(2)} AED</td>
                        <td className="border border-gray-300 px-2 py-1 text-right font-semibold text-emerald-700">{(c.total_paid || 0).toFixed(2)} AED</td>
                        <td className="border border-gray-300 px-2 py-1 text-right font-bold text-rose-700">{(c.due || 0).toFixed(2)} AED</td>
                        <td className="border border-gray-300 px-2 py-1 text-center">{c.sales_count || 0}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-[#f28f00] text-white font-bold text-xs">
                      <td colSpan={4} className="border border-gray-300 px-2 py-1.5 text-center uppercase">Total Summary</td>
                      <td className="border border-gray-300 px-2 py-1.5 text-right">{totalBilledAll.toFixed(2)} AED</td>
                      <td className="border border-gray-300 px-2 py-1.5 text-right">{totalPaidAll.toFixed(2)} AED</td>
                      <td className="border border-gray-300 px-2 py-1.5 text-right">{totalDueAll.toFixed(2)} AED</td>
                      <td className="border border-gray-300 px-2 py-1.5 text-center">{totalOrdersAll}</td>
                    </tr>
                  </tfoot>
                </table>

                {/* Footer Signature */}
                <div className="flex justify-between items-end mt-6 pt-3 border-t border-gray-200 text-[10px] text-gray-500">
                  <div>Generated by Azizi ERP System • Confidential</div>
                  <div>Authorized Signatory: _______________________</div>
                </div>
              </>
            );
          })()}
        </div>
      )}
      </div>
    </PermissionGuard>
  );
};
