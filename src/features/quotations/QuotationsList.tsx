import React, { useState, useEffect } from 'react';
import { db } from '../../lib/db';
import { PermissionGuard } from '../../components/PermissionGuard';
import { useAuth } from '../../components/AuthProvider';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Plus,
  Search,
  Printer,
  ReceiptText,
  Clock,
  X,
  MessageSquare,
  Trash2,
  CheckCircle,
  FileCheck2,
  Eye
} from 'lucide-react';

const handleWhatsAppShare = (quote: any) => {
  const customerName = quote.customer?.name || 'Customer';
  const quotationNo = quote.quotation_no;
  const grandTotal = quote.grand_total.toFixed(2);
  const itemsText = quote.items?.map((i: any) => `• ${i.service?.name || 'Service'} (Qty: ${i.quantity}) - ${(i.subtotal || 0).toFixed(2)} AED`).join('\n') || '';
  const validUntilText = quote.valid_until ? new Date(quote.valid_until).toLocaleDateString() : 'N/A';

  const message = `*AZIZI TYPING & STAMP MAKING*
Musaffah M37, Abu Dhabi
Tel: 0542797933

Dear *${customerName}*,
Here is the summary of your requested quotation:

*Quotation No:* #${quotationNo}
*Date:* ${new Date(quote.created_at).toLocaleDateString()}
*Valid Until:* ${validUntilText}

*Proposed Services:*
${itemsText}

*Grand Total:* ${grandTotal} AED

Thank you for choosing AZIZI!`;

  const rawPhone = quote.customer?.phone || '';
  const phone = rawPhone.replace(/\D/g, '');
  const url = phone 
    ? `https://wa.me/${phone}?text=${encodeURIComponent(message)}`
    : `https://wa.me/?text=${encodeURIComponent(message)}`;
    
  window.open(url, '_blank');
};

export const QuotationsList: React.FC = () => {
  const { hasPermission, activeBranchId } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const highlightId = searchParams.get('highlight');

  // Data States
  const [quotations, setQuotations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Filter States
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [sortField, setSortField] = useState<'created_at' | 'grand_total'>('created_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Detail Modal States
  const [selectedQuoteId, setSelectedQuoteId] = useState<string | null>(null);
  const [selectedQuoteDetails, setSelectedQuoteDetails] = useState<any | null>(null);
  const [converting, setConverting] = useState(false);

  // Status Update & Timeline States
  const [statusHistory, setStatusHistory] = useState<any[]>([]);
  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [updateStatusQuoteId, setUpdateStatusQuoteId] = useState<string | null>(null);
  const [newStatus, setNewStatus] = useState<'Draft' | 'Sent' | 'Accepted' | 'Rejected' | 'Expired' | 'Converted'>('Draft');
  const [remarks, setRemarks] = useState('');
  const [historyLogModalOpen, setHistoryLogModalOpen] = useState(false);
  const [viewHistoryQuoteNo, setViewHistoryQuoteNo] = useState<string>('');

  const fetchQuotations = async () => {
    setLoading(true);
    try {
      const branchFilterVal = activeBranchId === 'all' ? undefined : activeBranchId;
      const qData = await db.quotations.getAll(branchFilterVal);
      setQuotations(qData);

      // Refresh Detail Panel if open
      if (selectedQuoteId) {
        const detail = await db.quotations.getById(selectedQuoteId);
        setSelectedQuoteDetails(detail);
        const hist = await db.quotations.getStatusHistory(selectedQuoteId);
        setStatusHistory(hist);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQuotations();
  }, [activeBranchId, selectedQuoteId]);

  const handleOpenDetail = async (id: string) => {
    setSelectedQuoteId(id);
    setLoading(true);
    try {
      const detail = await db.quotations.getById(id);
      setSelectedQuoteDetails(detail);
      const hist = await db.quotations.getStatusHistory(id);
      setStatusHistory(hist);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const qId = updateStatusQuoteId || selectedQuoteId;
    if (!qId) return;
    try {
      await db.quotations.updateStatus(qId, newStatus, remarks);
      setStatusModalOpen(false);
      setRemarks('');
      setUpdateStatusQuoteId(null);
      await fetchQuotations();
    } catch (err) {
      console.error(err);
    }
  };

  const handleOpenHistoryLog = async (qId: string, qNo: string) => {
    try {
      setLoading(true);
      const hist = await db.quotations.getStatusHistory(qId);
      setStatusHistory(hist);
      setViewHistoryQuoteNo(qNo);
      setHistoryLogModalOpen(true);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this quotation?')) return;
    try {
      await db.quotations.delete(id);
      setSelectedQuoteDetails(null);
      setSelectedQuoteId(null);
      await fetchQuotations();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to delete quotation.');
    }
  };

  const handleConvertToSale = async (id: string) => {
    if (!window.confirm('Convert this quotation directly into a Sale invoice?')) return;
    setConverting(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const createdSale = await db.quotations.convertToSale(id);
      setSuccessMsg(`Quotation converted to Sale Invoice #${createdSale.invoice_no} successfully!`);
      setSelectedQuoteDetails(null);
      setSelectedQuoteId(null);
      
      // Auto redirect to sales with print template after 1.5 seconds
      setTimeout(() => {
        navigate(`/sales?print=${createdSale.id}`);
      }, 1500);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to convert quotation to sale.');
    } finally {
      setConverting(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  // Sort & Filter
  const filteredQuotations = quotations.filter(q => {
    const matchesSearch =
      q.quotation_no.toLowerCase().includes(search.toLowerCase()) ||
      (q.customer && q.customer.name.toLowerCase().includes(search.toLowerCase())) ||
      (q.customer && q.customer.phone && q.customer.phone.includes(search));

    const matchesStatus = statusFilter ? q.status === statusFilter : true;

    return matchesSearch && matchesStatus;
  }).sort((a, b) => {
    let multiplier = sortOrder === 'desc' ? -1 : 1;
    if (sortField === 'created_at') {
      return (new Date(a.created_at).getTime() - new Date(b.created_at).getTime()) * multiplier;
    } else {
      return (a.grand_total - b.grand_total) * multiplier;
    }
  });

  return (
    <PermissionGuard permission="Sales.View" fallback="ui">
      <div className="space-y-6 print:p-0 print:bg-white print:text-black">
        
        {/* HEADER */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 print:hidden">
          <div>
            <div className="text-xs font-bold text-primary uppercase tracking-wider mb-0.5">eQuotations</div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground m-0">List</h1>
          </div>
          {hasPermission('Sales.Create') && (
            <button
              onClick={() => navigate('/quotations/create')}
              className="flex items-center gap-1.5 bg-primary hover:bg-primary-hover text-white px-4 py-2.5 rounded-lg text-xs font-semibold shadow-md transition-all self-start sm:self-auto cursor-pointer"
            >
              <Plus size={14} />
              New Quotation
            </button>
          )}
        </div>

        {successMsg && (
          <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm p-4 rounded-xl text-center font-semibold animate-pulse print:hidden">
            {successMsg}
          </div>
        )}

        {errorMsg && (
          <div className="bg-destructive/10 border border-destructive/20 text-destructive text-sm p-4 rounded-xl text-center font-medium print:hidden">
            {errorMsg}
          </div>
        )}

        {/* TOOLBAR FILTERS */}
        <div className="flex flex-col lg:flex-row gap-3 bg-muted/30 p-3 rounded-xl border border-border print:hidden">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
            <input
              type="text"
              placeholder="Search by quotation no, customer name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 text-foreground"
            />
          </div>

          <div className="flex flex-wrap sm:flex-nowrap gap-2">
            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 bg-popover border border-border rounded-lg text-xs text-foreground font-semibold"
            >
              <option value="">All Statuses</option>
              <option value="Draft">Draft</option>
              <option value="Sent">Sent</option>
              <option value="Accepted">Accepted</option>
              <option value="Rejected">Rejected</option>
              <option value="Expired">Expired</option>
              <option value="Converted">Converted</option>
            </select>

            {/* Sort Field */}
            <select
              value={`${sortField}-${sortOrder}`}
              onChange={(e) => {
                const [field, order] = e.target.value.split('-') as [any, any];
                setSortField(field);
                setSortOrder(order);
              }}
              className="px-3 py-2 bg-popover border border-border rounded-lg text-xs text-foreground font-semibold"
            >
              <option value="created_at-desc">Newest First</option>
              <option value="created_at-asc">Oldest First</option>
              <option value="grand_total-desc">Highest Total</option>
              <option value="grand_total-asc">Lowest Total</option>
            </select>
          </div>
        </div>

        {/* MAIN LIST VIEW */}
        <div className="w-full">
          <div className="w-full space-y-4 print:hidden">
            {loading ? (
              <div className="table-container p-12 text-center bg-card border border-border rounded-xl">
                <div className="flex flex-col items-center justify-center gap-3">
                  <div className="h-8 w-8 border-3 border-primary border-t-transparent rounded-full animate-spin" />
                  <span className="text-xs font-bold tracking-wider uppercase text-primary animate-pulse">Loading...</span>
                  <p className="text-[11px] text-muted-foreground font-medium">Please wait while quotations are being loaded...</p>
                </div>
              </div>
            ) : (
              <div className="table-container">
                <div className="overflow-x-auto">
                  <table>
                    <thead>
                      <tr>
                        <th className="text-center" style={{ width: '45px' }}>SL</th>
                        <th>Quotation No & Date</th>
                        <th>Customer</th>
                        <th>Valid Until</th>
                        <th>Status</th>
                        <th className="text-right">Grand Total</th>
                        <th className="text-center" style={{ width: '160px' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredQuotations.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="py-12 text-center text-slate-500">
                            <div className="max-w-xs mx-auto space-y-1">
                              <div className="font-bold text-black text-sm font-heading">No matching quotations found</div>
                              <div className="text-xs text-slate-500">Try adjusting your search query or status filter above.</div>
                            </div>
                          </td>
                        </tr>
                      ) : (
                        filteredQuotations.map((q, idx) => {
                          const isSelected = selectedQuoteId === q.id;
                          const isHighlighted = highlightId?.split(',').includes(q.id);
                          return (
                            <tr
                              key={q.id}
                              style={isHighlighted ? { backgroundColor: 'color-mix(in srgb, var(--color-primary) 5%, transparent)' } : undefined}
                              className={`cursor-pointer ${
                                isSelected ? 'bg-primary/5 font-medium' : ''
                              }`}
                              onClick={() => handleOpenDetail(q.id)}
                            >
                              <td className="text-center font-semibold text-xs text-slate-500">
                                {idx + 1}
                              </td>
                              <td>
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-100 border border-slate-200 text-black font-mono font-bold text-xs tracking-wide">
                                  #{q.quotation_no}
                                </span>
                                <div className="text-[11px] text-slate-500 mt-1">
                                  {new Date(q.created_at).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                                </div>
                              </td>
                              <td>
                                <div className="font-bold text-black text-xs leading-tight">
                                  {q.customer?.name || 'Walk-in Customer'}
                                </div>
                                <div className="text-[11px] text-slate-500 mt-0.5">
                                  {q.customer?.phone || ''}
                                </div>
                              </td>
                              <td>
                                <span className="text-xs text-black font-medium">
                                  {q.valid_until ? new Date(q.valid_until).toLocaleDateString() : '—'}
                                </span>
                              </td>
                              <td onClick={(e) => { e.stopPropagation(); handleOpenHistoryLog(q.id, q.quotation_no); }} title="Click to view status history steps">
                                <span className={`badge badge-${q.status === 'Converted' || q.status === 'Accepted' ? 'success' : q.status === 'Draft' || q.status === 'Sent' ? 'info' : q.status === 'Rejected' || q.status === 'Expired' ? 'danger' : 'warning'}`}>
                                  {q.status}
                                </span>
                              </td>
                              <td className="text-right font-black text-black text-sm font-heading">
                                {q.grand_total.toFixed(2)} <span className="text-[10px] font-medium text-slate-500">AED</span>
                              </td>
                              <td onClick={(e) => e.stopPropagation()}>
                                <div className="flex items-center justify-center gap-1.5">
                                  <button
                                    onClick={() => handleOpenDetail(q.id)}
                                    className="w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-black flex items-center justify-center transition-all cursor-pointer shadow-2xs"
                                    title="View Quotation Details"
                                  >
                                    <Eye size={13} />
                                  </button>
                                  <button
                                    onClick={async () => {
                                      const detail = await db.quotations.getById(q.id);
                                      setSelectedQuoteId(q.id);
                                      setSelectedQuoteDetails(detail);
                                      setTimeout(() => {
                                        window.print();
                                      }, 400);
                                    }}
                                    className="w-7 h-7 rounded-full bg-primary/10 hover:bg-primary text-primary hover:text-white flex items-center justify-center transition-all cursor-pointer shadow-2xs"
                                    title="Print Quotation"
                                  >
                                    <Printer size={13} />
                                  </button>
                                  {q.status !== 'Converted' && (
                                    <>
                                      <button
                                        onClick={() => {
                                          setUpdateStatusQuoteId(q.id);
                                          setNewStatus(q.status);
                                          setRemarks('');
                                          setStatusModalOpen(true);
                                        }}
                                        className="w-7 h-7 rounded-full bg-amber-500/10 hover:bg-amber-500 text-amber-600 hover:text-white flex items-center justify-center transition-all cursor-pointer shadow-2xs"
                                        title="Change Status"
                                      >
                                        <Clock size={13} />
                                      </button>
                                      <button
                                        onClick={() => handleConvertToSale(q.id)}
                                        disabled={converting}
                                        className="w-7 h-7 rounded-full bg-emerald-500/10 hover:bg-emerald-500 text-emerald-600 hover:text-white flex items-center justify-center transition-all cursor-pointer shadow-2xs"
                                        title="Convert to Sale Invoice"
                                      >
                                        <FileCheck2 size={13} />
                                      </button>
                                    </>
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
          </div>

          {/* DETAIL MODAL PANEL */}
          {selectedQuoteDetails && (() => {
            const quote = selectedQuoteDetails;
            const items = quote.items || [];
            const canConvert = quote.status !== 'Converted';

            return (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/75 backdrop-blur-md print:p-0 print:bg-white print:static overflow-y-auto">
                <div className="relative w-full max-w-4xl max-h-[94vh] overflow-y-auto print:max-h-none print:overflow-visible my-auto space-y-4 print:space-y-0 print:my-0 print:w-full">
                  
                  {/* TOP CONTROL TOOLBAR (Hidden in Print / PDF) */}
                  <div className="sticky top-0 z-20 flex items-center justify-between p-3.5 bg-card/95 backdrop-blur-md border border-border rounded-2xl shadow-xl print:hidden">
                    <div className="flex items-center gap-2">
                      <div className="p-2 rounded-xl bg-primary/10 text-primary">
                        <ReceiptText size={18} />
                      </div>
                      <div>
                        <div className="font-bold text-xs text-foreground">Quotation Document Preview</div>
                        <div className="text-[11px] text-muted-foreground">Quote #{quote.quotation_no} • {new Date(quote.created_at).toLocaleDateString()}</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handlePrint}
                        className="flex items-center gap-1.5 px-4 py-2 bg-primary hover:bg-primary-hover text-white rounded-xl text-xs font-bold shadow-md shadow-primary/20 transition-all cursor-pointer"
                      >
                        <Printer size={14} />
                        <span>Print / Save PDF</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleWhatsAppShare(quote)}
                        className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer"
                      >
                        <MessageSquare size={14} />
                        <span className="hidden sm:inline">WhatsApp</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => { setSelectedQuoteDetails(null); setSelectedQuoteId(null); }}
                        className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted/80 rounded-xl transition-colors cursor-pointer"
                        title="Close (Esc)"
                      >
                        <X size={18} />
                      </button>
                    </div>
                  </div>

                  {/* PRINTABLE QUOTATION PAPER SHEET */}
                  <div className="print-invoice-sheet bg-white text-black p-6 sm:p-8 rounded-2xl shadow-2xl border border-border/80 print:border-none print:shadow-none print:p-0 print:rounded-none text-xs font-sans">
                    <div className="w-full">
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

                      {/* 2. Blue Quotation Banner */}
                      <div className="bg-[#000ba0] text-white flex items-center justify-between px-3.5 py-1.5 font-bold uppercase tracking-wider text-xs my-2.5 rounded-xs">
                        <span className="font-extrabold tracking-widest text-[12px]">PRICE QUOTATION / عرض أسعار</span>
                        <span className="bg-[#f28f00] text-white px-3 py-0.5 rounded font-mono text-xs tracking-wider">
                          # {quote.quotation_no}
                        </span>
                      </div>

                      {/* 3. Structured Quotation Metadata Grid Table */}
                      <table className="w-full border-collapse border border-gray-300 text-xs my-2.5 bg-white text-black">
                        <tbody>
                          <tr>
                            <td className="bg-[#f28f00] text-white font-extrabold px-3 py-2 border border-gray-300 w-[22%] uppercase tracking-wider align-middle">
                              QUOTATION TO
                            </td>
                            <td className="px-3 py-2 border border-gray-300 text-black w-[78%]" colSpan={3}>
                              {(() => {
                                if (!quote.customer) return <span className="font-extrabold text-sm">Walk-in / Individual</span>;
                                const companyName = quote.customer.customer_type === 'company' 
                                  ? quote.customer.name 
                                  : (quote.customer.company?.name || quote.customer.name);
                                const companyPhone = quote.customer.customer_type === 'company'
                                  ? quote.customer.phone
                                  : (quote.customer.company?.phone || quote.customer.phone);
                                return (
                                  <div className="flex flex-col">
                                    <span className="font-black text-black text-[13px] uppercase">{companyName}</span>
                                    <div className="flex items-center gap-4 text-[10px] text-gray-700 font-medium mt-0.5">
                                      {companyPhone && (
                                        <span><strong className="text-gray-900">Phone:</strong> {companyPhone}</span>
                                      )}
                                      {quote.customer.trn && (
                                        <span><strong className="text-gray-900">TRN:</strong> {quote.customer.trn}</span>
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
                                const memberName = quote.person_name 
                                  || (quote.customer?.customer_type !== 'company' ? quote.customer?.name : '') 
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
                              {new Date(quote.created_at).toLocaleDateString()}
                            </td>
                          </tr>
                          <tr>
                            <td className="bg-gray-50 text-gray-800 font-bold px-3 py-1.5 border border-gray-300 w-[22%]">
                              Valid Until:
                            </td>
                            <td className="px-3 py-1.5 border border-gray-300 text-rose-700 font-bold w-[28%]">
                              {quote.valid_until ? new Date(quote.valid_until).toLocaleDateString() : '30 Days from issue'}
                            </td>
                            <td className="bg-gray-50 text-gray-800 font-bold px-3 py-1.5 border border-gray-300 w-[22%] text-center">
                              Prepared By
                            </td>
                            <td className="px-3 py-1.5 border border-gray-300 text-black font-semibold text-center w-[28%]">
                              {quote.employee?.name || 'Staff'}
                            </td>
                          </tr>
                        </tbody>
                      </table>

                      {/* 4. Line Items Table */}
                      <div className="border border-gray-300 overflow-hidden my-2.5 text-xs bg-white">
                        <table className="w-full text-left border-collapse">
                          <thead className="bg-[#000ba0] text-white font-bold">
                            <tr>
                              <th className="px-3 py-2 text-center border-r border-gray-300 w-[6%] font-extrabold">No</th>
                              <th className="px-3 py-2 border-r border-gray-300 w-[55%] font-extrabold">Description of Service / الخدمة</th>
                              <th className="px-3 py-2 text-center border-r border-gray-300 w-[11%] font-extrabold">Qty</th>
                              <th className="px-3 py-2 text-right border-r border-gray-300 w-[14%] font-extrabold">Rate</th>
                              <th className="px-3 py-2 text-right w-[14%] font-extrabold">Amount</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-300 text-black">
                            {items.length === 0 ? (
                              <tr>
                                <td colSpan={5} className="px-3 py-6 text-center text-gray-400 italic">
                                  No items linked to this quotation.
                                </td>
                              </tr>
                            ) : (
                              items.map((item: any, itemIdx: number) => (
                                <tr key={item.id || itemIdx} className="h-8">
                                  <td className="px-3 py-1.5 text-center border-r border-gray-300 font-bold">{itemIdx + 1}</td>
                                  <td className="px-3 py-1.5 border-r border-gray-300 text-left">
                                    <span className="font-extrabold text-black">{item.service?.name || 'Service Item'}</span>
                                    {item.notes && (
                                      <span className="block font-normal text-[10px] text-gray-600 italic">
                                        Note: {item.notes}
                                      </span>
                                    )}
                                  </td>
                                  <td className="px-3 py-1.5 text-center border-r border-gray-300 font-bold">{item.quantity}</td>
                                  <td className="px-3 py-1.5 text-right border-r border-gray-300 font-mono">{item.unit_price.toFixed(2)}</td>
                                  <td className="px-3 py-1.5 text-right font-mono font-black">{item.subtotal.toFixed(2)}</td>
                                </tr>
                              ))
                            )}
                          </tbody>
                          <tfoot>
                            <tr className="bg-[#f28f00] text-white font-extrabold border-t border-gray-300 text-xs">
                              <td className="px-3 py-1.5 text-center border-r border-gray-300 uppercase tracking-wider" colSpan={4}>
                                Total Proposed Amount
                              </td>
                              <td className="px-3 py-1.5 text-right font-mono font-black">
                                {quote.grand_total.toFixed(2)} AED
                              </td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>

                      {/* 5. Terms & Remarks */}
                      {((quote.terms_conditions && quote.terms_conditions.length > 0) || quote.notes) && (
                        <div className="my-2.5 p-3 border border-gray-300 rounded-xs text-xs bg-gray-50/60 text-black">
                          <div className="font-bold text-gray-900 uppercase text-[11px] tracking-wider mb-1">
                            Terms &amp; Conditions / الشروط والأحكام:
                          </div>
                          {quote.terms_conditions && quote.terms_conditions.length > 0 && (
                            <ol className="list-decimal pl-4 space-y-0.5 text-[11px] text-gray-700 font-medium">
                              {quote.terms_conditions.map((tc: any) => (
                                <li key={tc.id}>
                                  <span className="font-bold text-black">{tc.title}:</span> {tc.content}
                                </li>
                              ))}
                            </ol>
                          )}
                          {quote.notes && (
                            <div className="text-[11px] text-gray-700 font-medium whitespace-pre-line border-t border-gray-300 pt-1.5 mt-1.5 italic">
                              {quote.notes}
                            </div>
                          )}
                        </div>
                      )}

                      {/* 6. Signature Lines */}
                      <div className="pt-6 mt-4 border-t border-gray-300">
                        <div className="grid grid-cols-2 gap-8 items-end text-xs">
                          <div className="text-center">
                            <div className="border-b border-gray-400 w-3/4 mx-auto mb-1"></div>
                            <div className="text-[10px] font-bold text-gray-700 uppercase tracking-wide">
                              Customer Acceptance Signature / قبول العميل
                            </div>
                          </div>

                          <div className="text-center">
                            <div className="border-b border-gray-400 w-3/4 mx-auto mb-1"></div>
                            <div className="text-[10px] font-bold text-gray-700 uppercase tracking-wide">
                              Authorized Signature &amp; Official Stamp / الختم والتوقيع
                            </div>
                          </div>
                        </div>

                        <div className="text-center text-[9px] text-gray-500 mt-4 tracking-wide font-medium">
                          Official Quotation Document • Azizi Typing &amp; Stamp Making L.L.C • Abu Dhabi, UAE
                        </div>
                      </div>

                    </div>
                  </div>

                  {/* BOTTOM WORKFLOW & ACTIONS PANEL (Hidden on Print / PDF) */}
                  <div className="p-4 bg-card border border-border rounded-2xl shadow-xl space-y-4 print:hidden">
                    {/* Action buttons */}
                    <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
                      <div className="flex flex-wrap items-center gap-2">
                        {hasPermission('Sales.Delete') && (
                          <button
                            type="button"
                            onClick={() => handleDelete(quote.id)}
                            className="flex items-center gap-1 bg-rose-500/10 hover:bg-rose-500 text-rose-500 hover:text-white px-4 py-2 rounded-xl font-bold transition-all shadow-xs border border-rose-500/20 cursor-pointer"
                          >
                            <Trash2 size={14} />
                            <span>Delete</span>
                          </button>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        {quote.status !== 'Converted' && (
                          <button
                            type="button"
                            onClick={() => {
                              setUpdateStatusQuoteId(quote.id);
                              setNewStatus(quote.status);
                              setRemarks('');
                              setStatusModalOpen(true);
                            }}
                            className="flex items-center gap-1.5 bg-secondary hover:bg-muted text-foreground px-3.5 py-2 rounded-xl font-bold transition-all shadow-xs border border-border cursor-pointer"
                          >
                            <Clock size={13} />
                            <span>Change Status</span>
                          </button>
                        )}

                        {canConvert && (
                          <button
                            type="button"
                            onClick={() => handleConvertToSale(quote.id)}
                            disabled={converting}
                            className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl font-bold transition-all shadow-md cursor-pointer"
                          >
                            <CheckCircle size={14} />
                            <span>Convert to Bill Invoice</span>
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Status Change History Timeline */}
                    {statusHistory.length > 0 && (
                      <div className="space-y-3 pt-3 border-t border-border/60">
                        <h3 className="text-xs uppercase font-bold text-muted-foreground tracking-wider flex items-center gap-1.5">
                          <Clock size={13} className="text-primary" />
                          Status History Log
                        </h3>
                        <div className="relative border-l border-border pl-4 space-y-3">
                          {statusHistory.map((h, i) => (
                            <div key={h.id || i} className="relative">
                              <div className="absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full bg-primary border-2 border-background" />
                              <div className="flex flex-wrap items-center gap-2">
                                <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold border ${
                                  h.status === 'Converted' ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' :
                                  h.status === 'Accepted' ? 'bg-blue-500/10 text-blue-600 border-blue-500/20' :
                                  h.status === 'Draft' ? 'bg-muted text-muted-foreground border-border' :
                                  h.status === 'Sent' ? 'bg-indigo-500/10 text-indigo-600 border-indigo-500/20' :
                                  h.status === 'Rejected' ? 'bg-rose-500/10 text-rose-600 border-rose-500/20' :
                                  'bg-amber-500/10 text-amber-600 border-amber-500/20'
                                }`}>
                                  {h.status}
                                </span>
                                <span className="text-[10px] text-muted-foreground font-medium">
                                  by {h.changed_by_name || 'System'} on {new Date(h.changed_at).toLocaleString()}
                                </span>
                              </div>
                              {h.remarks && (
                                <p className="text-[11px] text-foreground mt-1 bg-muted/30 p-2 rounded-lg border border-border/50 max-w-xl font-medium">
                                  {h.remarks}
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                </div>
              </div>
            );
          })()}
        </div>

        {/* UPDATE STATUS MODAL */}
        {statusModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="glass border border-border rounded-2xl p-6 w-full max-w-md bg-white shadow-2xl relative">
              <h3 className="text-sm font-bold text-foreground mb-4">Update Quotation Status</h3>
              <form onSubmit={handleStatusSubmit} className="space-y-4">
                <div>
                  <label className="block text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5">New Status</label>
                  <select
                    value={newStatus}
                    onChange={(e) => setNewStatus(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-card text-xs font-semibold text-foreground focus:ring-1 focus:ring-primary cursor-pointer"
                  >
                    <option value="Draft">Draft</option>
                    <option value="Sent">Sent</option>
                    <option value="Accepted">Accepted</option>
                    <option value="Rejected">Rejected</option>
                    <option value="Expired">Expired</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5">Remarks / Comments</label>
                  <textarea
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    placeholder="e.g. Customer approved this draft quotation..."
                    rows={3}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-card text-xs font-medium text-foreground focus:ring-1 focus:ring-primary resize-none"
                  />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setStatusModalOpen(false)}
                    className="px-4 py-2 border border-border text-foreground hover:bg-muted text-xs font-bold rounded-xl transition-all cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-primary hover:bg-primary/95 text-white text-xs font-bold rounded-xl transition-all shadow-md cursor-pointer"
                  >
                    Save Status
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* STATUS HISTORY LOG POPUP MODAL */}
        {historyLogModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="glass border border-border rounded-2xl p-6 w-full max-w-lg bg-white shadow-2xl relative">
              {/* Close Button */}
              <button
                onClick={() => setHistoryLogModalOpen(false)}
                className="absolute right-4 top-4 p-2 text-muted-foreground hover:text-foreground bg-muted/40 rounded-full transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
              
              <div className="flex items-center gap-2 mb-6">
                <Clock size={16} className="text-primary" />
                <div>
                  <h3 className="text-sm font-bold text-foreground leading-none">Status History Steps</h3>
                  <span className="text-[10px] text-muted-foreground font-mono mt-1 block">Quotation #{viewHistoryQuoteNo}</span>
                </div>
              </div>

              {statusHistory.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-6">No status changes have been recorded for this quotation yet.</p>
              ) : (
                <div className="relative border-l border-border pl-4 space-y-5 my-2 max-h-72 overflow-y-auto">
                  {statusHistory.map((h, i) => (
                    <div key={h.id || i} className="relative">
                      {/* Dot */}
                      <div className="absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full bg-primary border-2 border-background" />
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold border ${
                          h.status === 'Converted' ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20' :
                          h.status === 'Accepted' ? 'bg-blue-500/10 text-blue-600 border border-blue-500/20' :
                          h.status === 'Draft' ? 'bg-muted text-muted-foreground border border-border' :
                          h.status === 'Sent' ? 'bg-indigo-500/10 text-indigo-600 border border-indigo-500/20' :
                          h.status === 'Rejected' ? 'bg-rose-500/10 text-rose-600 border border-rose-500/20' :
                          'bg-amber-500/10 text-amber-600 border border-amber-500/20'
                        }`}>
                          {h.status}
                        </span>
                        <span className="text-[10px] text-muted-foreground font-medium">
                          by {h.changed_by_name || 'System'} on {new Date(h.changed_at).toLocaleString()}
                        </span>
                      </div>
                      {h.remarks && (
                        <p className="text-[11px] text-foreground mt-1.5 bg-muted/30 p-2 rounded-lg border border-border/50 max-w-xl font-medium">
                          {h.remarks}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}

              <div className="flex justify-end pt-4 border-t border-border mt-6">
                <button
                  onClick={() => setHistoryLogModalOpen(false)}
                  className="px-4 py-2 bg-secondary hover:bg-muted text-foreground text-xs font-bold rounded-xl transition-all cursor-pointer"
                >
                  Close Logs
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </PermissionGuard>
  );
};
