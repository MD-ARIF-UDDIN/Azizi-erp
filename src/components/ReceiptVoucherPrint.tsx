import React from 'react';

export interface PrintableVoucherData {
  type: 'receipt' | 'refund';
  voucherNo?: string;
  date: string;
  amount: number;
  paymentMethod?: string;
  personName?: string;
  reason?: string;
  account?: any;
  sale?: any;
  transactionNo?: string;
}

export function numberToWords(num: number): string {
  const a = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  
  const inWords = (n: number): string => {
    if (n === 0) return '';
    if (n < 20) return a[n];
    if (n < 100) return b[Math.floor(n / 10)] + (n % 10 ? ' ' + a[n % 10] : '');
    if (n < 1000) return a[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' ' + inWords(n % 100) : '');
    if (n < 1000000) return inWords(Math.floor(n / 1000)) + ' Thousand' + (n % 1000 ? ' ' + inWords(n % 1000) : '');
    return inWords(Math.floor(n / 1000000)) + ' Million' + (n % 1000000 ? ' ' + inWords(n % 1000000) : '');
  };

  const integerPart = Math.floor(Math.abs(num));
  const decimalPart = Math.round((Math.abs(num) - integerPart) * 100);

  if (integerPart === 0 && decimalPart === 0) return 'Zero UAE Dirhams Only';

  let result = (integerPart > 0 ? inWords(integerPart) : 'Zero') + ' UAE Dirhams';
  if (decimalPart > 0) {
    result += ' and ' + inWords(decimalPart) + ' Fills';
  }
  return result + ' Only';
}

export const ReceiptVoucherPrint: React.FC<{ data: PrintableVoucherData | null }> = ({ data }) => {
  if (!data) return null;

  const isReceipt = data.type === 'receipt';
  const custName = data.sale?.customer?.name || data.sale?.sale_customer_name || 'Walk-in Customer';
  const compName = data.sale?.customer?.company?.name || data.sale?.sale_customer_company_name;
  const custPhone = data.sale?.customer?.phone || data.sale?.customer?.company?.phone;
  const custTrn = data.sale?.customer?.trn;

  const rawPerson = data.personName?.trim();
  const isDistinctMember = Boolean(
    rawPerson &&
    rawPerson !== '' &&
    rawPerson.toLowerCase() !== custName.toLowerCase() &&
    (!compName || rawPerson.toLowerCase() !== compName.toLowerCase())
  );

  const grandTotal = Number(data.sale?.grand_total) || 0;
  const paymentsList = data.sale?.payments || [];
  const totalPaid = paymentsList.reduce((sum: number, p: any) => sum + Number(p.amount || 0), 0);
  const remainingDue = grandTotal > 0 ? Math.max(0, grandTotal - totalPaid) : 0;

  const primaryColor = isReceipt ? '#000ba0' : '#b91c1c';
  const primaryLight = isReceipt ? '#eff6ff' : '#fef2f2';
  const primaryBorder = isReceipt ? '#93c5fd' : '#fca5a5';

  return (
    <div className="hidden print:block fixed inset-0 bg-white text-slate-900 p-8 font-sans text-xs print-voucher-sheet">
      <div className="max-w-4xl mx-auto border border-slate-300 rounded-lg p-7 bg-white space-y-5 shadow-none">
        
        {/* TOP OFFICIAL LETTERHEAD */}
        <div className="flex items-center justify-between border-b-2 border-[#000ba0] pb-4">
          <div className="flex items-center gap-4">
            <img src="/logo.png" alt="AZIZI" className="w-20 h-20 object-contain shrink-0" />
            <div>
              <div className="text-sm font-black text-[#000ba0] uppercase tracking-wide">
                AZIZI TYPING &amp; STAMP MAKING BR. 1
              </div>
              <div className="text-xs font-semibold text-slate-700 mt-0.5">
                Musaffah M37, Abu Dhabi, United Arab Emirates
              </div>
              <div className="text-[11px] text-slate-600 mt-0.5 flex items-center gap-3">
                <span><strong>Tel:</strong> +971 54 279 7933</span>
                <span>•</span>
                <span><strong>Email:</strong> azizitypingbr@gmail.com</span>
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">
                Near Irani Masjid, Industrial Area
              </div>
            </div>
          </div>

          <div className="text-right space-y-0.5">
            <div className="text-lg font-black text-[#000ba0] leading-tight" style={{ fontFamily: "'Cairo', 'Segoe UI', Tahoma, sans-serif" }}>
              مكتب عزيزي للكتابة وعمل الأختام ذ.م.م - فرع ۱
            </div>
            <div className="text-xs font-bold text-[#f28f00]">
              خدمات الطباعة، تخليص المعاملات، وعمل الأختام
            </div>
            <div className="text-[11px] text-slate-600 font-medium">
              مصفح م٣٧، أبوظبي، الإمارات العربية المتحدة
            </div>
            <div className="text-[10px] text-slate-500">
              هاتف: ٠٥٤٢٧٩٧٩٣٣
            </div>
          </div>
        </div>

        {/* VOUCHER TITLE & META HEADER */}
        <div className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-md p-3.5">
          <div>
            <div className="flex items-center gap-2">
              <span 
                className="px-2.5 py-1 text-white font-black text-xs rounded uppercase tracking-wider"
                style={{ backgroundColor: primaryColor }}
              >
                {isReceipt ? 'RECEIPT VOUCHER' : 'REFUND VOUCHER'}
              </span>
              <span className="text-xs font-bold text-slate-700" style={{ fontFamily: "'Cairo', sans-serif" }}>
                {isReceipt ? 'سند قبض مالي رسمي' : 'سند صرف واسترجاع مالي'}
              </span>
            </div>
            <p className="text-[10px] text-slate-500 mt-1 italic">
              {isReceipt 
                ? 'Official acknowledgement of payment received for professional services' 
                : 'Official acknowledgement of funds returned / refunded'}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-right text-xs">
            <div>
              <span className="text-[10px] text-slate-500 uppercase font-semibold block">Voucher No / رقم السند:</span>
              <span className="font-mono font-black text-slate-900 text-sm tracking-wider" style={{ color: primaryColor }}>
                {data.voucherNo}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-slate-500 uppercase font-semibold block">Date &amp; Time / التاريخ:</span>
              <span className="font-semibold text-slate-800 text-[11px]">
                {new Date(data.date).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
              </span>
            </div>
          </div>
        </div>

        {/* STRUCTURED PARTICULARS TABLE */}
        <table className="w-full border-collapse border border-slate-300 text-xs">
          <tbody>
            {/* Received From */}
            <tr className="border-b border-slate-300">
              <td className="p-3 bg-slate-50 font-bold text-slate-700 w-[28%] border-r border-slate-300 align-top">
                <div className="font-bold text-slate-800">{isReceipt ? 'Received From:' : 'Paid / Returned To:'}</div>
                <div className="text-[10px] text-slate-500 font-normal">{isReceipt ? 'استلمنا من السيد / السادة' : 'صرف إلى السيد / السادة'}</div>
              </td>
              <td className="p-3 font-semibold text-slate-900 border-r border-slate-300" colSpan={isDistinctMember ? 1 : 3}>
                <div className="text-sm font-black text-slate-900">{custName}</div>
                {compName && compName !== custName && (
                  <div className="text-xs text-slate-600 font-semibold mt-0.5">Company: {compName}</div>
                )}
                {(custPhone || custTrn) && (
                  <div className="text-[10px] text-slate-500 mt-1 flex items-center gap-3">
                    {custPhone && <span><strong>Phone:</strong> {custPhone}</span>}
                    {custTrn && <span><strong>TRN:</strong> {custTrn}</span>}
                  </div>
                )}
              </td>
              {isDistinctMember && (
                <>
                  <td className="p-3 bg-slate-50 font-bold text-slate-700 w-[22%] border-r border-slate-300 align-top">
                    <div className="font-bold text-slate-800">For Member / Applicant:</div>
                    <div className="text-[10px] text-slate-500 font-normal">لصالح العميل / صاحب المعاملة</div>
                  </td>
                  <td className="p-3 font-bold text-slate-900 w-[28%] align-top">
                    <div className="text-xs font-black text-slate-900">{rawPerson}</div>
                  </td>
                </>
              )}
            </tr>

            {/* Payment Mode & References */}
            <tr className="border-b border-slate-300">
              <td className="p-3 bg-slate-50 font-bold text-slate-700 border-r border-slate-300">
                <div className="font-bold text-slate-800">Payment Mode:</div>
                <div className="text-[10px] text-slate-500 font-normal">طريقة الدفع</div>
              </td>
              <td className="p-3 font-bold text-slate-900 border-r border-slate-300">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 rounded text-xs text-slate-900 font-bold border border-slate-200">
                  {isReceipt ? '💵 ' : '↩ '}{data.paymentMethod || 'Cash'}
                </span>
              </td>
              <td className="p-3 bg-slate-50 font-bold text-slate-700 border-r border-slate-300">
                <div className="font-bold text-slate-800">Invoice Reference #:</div>
                <div className="text-[10px] text-slate-500 font-normal">رقم الفاتورة المرجعية</div>
              </td>
              <td className="p-3 font-mono font-bold text-slate-900">
                {data.sale?.invoice_no ? (
                  <span className="px-2 py-0.5 bg-blue-50 text-[#000ba0] border border-blue-200 rounded text-xs font-black">
                    #{data.sale.invoice_no}
                  </span>
                ) : '—'}
                {data.transactionNo && (
                  <div className="text-[10px] text-slate-600 font-mono mt-1">
                    <strong>Ref / Slip:</strong> {data.transactionNo}
                  </div>
                )}
              </td>
            </tr>

            {/* The Sum Of (In Words) */}
            <tr className="border-b border-slate-300">
              <td className="p-3 bg-slate-50 font-bold text-slate-700 border-r border-slate-300">
                <div className="font-bold text-slate-800">The Sum Of (In Words):</div>
                <div className="text-[10px] text-slate-500 font-normal">المبلغ بالحروف</div>
              </td>
              <td className="p-3 font-bold text-slate-900 italic text-xs" colSpan={3}>
                <span className="text-slate-900 font-black">{numberToWords(data.amount)}</span>
              </td>
            </tr>

            {/* Purpose / Remarks */}
            <tr className="border-b border-slate-300">
              <td className="p-3 bg-slate-50 font-bold text-slate-700 border-r border-slate-300">
                <div className="font-bold text-slate-800">Being / Purpose:</div>
                <div className="text-[10px] text-slate-500 font-normal">وذلك مقابل / البيان</div>
              </td>
              <td className="p-3 text-slate-800 font-medium text-xs leading-relaxed" colSpan={3}>
                {data.reason || (isReceipt ? `Settlement of Typing, Visa & Government Services Invoice #${data.sale?.invoice_no || ''}` : 'Application cancellation / Refund')}
              </td>
            </tr>
          </tbody>
        </table>

        {/* AMOUNT HIGHLIGHT BOX */}
        <div 
          className="p-4 rounded-lg border-2 flex items-center justify-between"
          style={{ backgroundColor: primaryLight, borderColor: primaryBorder }}
        >
          <div>
            <span className="text-xs uppercase font-black tracking-wider block" style={{ color: primaryColor }}>
              {isReceipt ? 'TOTAL AMOUNT RECEIVED • المبلغ المستلم' : 'TOTAL AMOUNT REFUNDED • المبلغ المسترجع'}
            </span>
            <span className="text-[11px] text-slate-600 font-medium">
              Official Currency: United Arab Emirates Dirham (AED)
            </span>
          </div>
          <div className="text-right">
            <span className="text-3xl font-black font-mono tracking-tight" style={{ color: primaryColor }}>
              {data.amount.toFixed(2)} <span className="text-base font-bold font-sans">AED</span>
            </span>
          </div>
        </div>

        {/* INVOICE ACCOUNT STATEMENT BREAKDOWN (IF ATTACHED TO SALE) */}
        {data.sale && grandTotal > 0 && (
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3.5">
            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">
              Invoice Statement Summary • ملخص حساب الفاتورة
            </div>
            <div className="grid grid-cols-4 gap-3 text-center">
              <div className="p-2 bg-white rounded border border-slate-200">
                <span className="text-[10px] text-slate-500 font-semibold block">Total Invoice Amount</span>
                <span className="text-xs font-black font-mono text-slate-900">{grandTotal.toFixed(2)} AED</span>
              </div>
              <div className="p-2 bg-white rounded border border-slate-200">
                <span className="text-[10px] text-slate-500 font-semibold block">Total Paid So Far</span>
                <span className="text-xs font-black font-mono text-emerald-700">{totalPaid.toFixed(2)} AED</span>
              </div>
              <div className="p-2 bg-white rounded border border-slate-200">
                <span className="text-[10px] text-slate-500 font-semibold block">Balance Remaining</span>
                <span className={`text-xs font-black font-mono ${remainingDue > 0 ? 'text-amber-700' : 'text-slate-900'}`}>
                  {remainingDue.toFixed(2)} AED
                </span>
              </div>
              <div className="p-2 bg-white rounded border border-slate-200">
                <span className="text-[10px] text-slate-500 font-semibold block">Account Status</span>
                <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded inline-block mt-0.5 ${
                  remainingDue <= 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                }`}>
                  {remainingDue <= 0 ? 'Fully Paid / مسدد' : 'Partially Paid / جزئي'}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* SIGNATURES AND OFFICIAL STAMP BLOCK */}
        <div className="grid grid-cols-3 gap-6 pt-4 pb-2 text-center text-xs">
          <div className="flex flex-col justify-between h-24">
            <div className="text-[11px] font-bold text-slate-700">
              Cashier / Prepared By
              <span className="block text-[9px] text-slate-400 font-normal">توقيع المحاسب / المستلم</span>
            </div>
            <div>
              <div className="border-t border-slate-400 pt-1 font-semibold text-slate-900 text-xs">
                Authorized Cashier
              </div>
            </div>
          </div>

          <div className="flex flex-col items-center justify-center">
            <div className="w-24 h-24 border border-slate-300 rounded-full flex flex-col items-center justify-center p-1 text-center bg-slate-50/50">
              <span className="text-[8px] font-black uppercase text-slate-400 tracking-wider">AZIZI TYPING</span>
              <span className="text-[8px] font-bold text-slate-400">OFFICIAL STAMP</span>
              <span className="text-[7px] text-slate-400 mt-0.5">ختم الشركة</span>
            </div>
          </div>

          <div className="flex flex-col justify-between h-24">
            <div className="text-[11px] font-bold text-slate-700">
              Customer / Depositor Signature
              <span className="block text-[9px] text-slate-400 font-normal">توقيع العميل / المودع</span>
            </div>
            <div>
              <div className="border-t border-slate-400 pt-1 font-semibold text-slate-900 text-xs">
                Signature &amp; Date
              </div>
            </div>
          </div>
        </div>

        {/* FOOTER BAR */}
        <div className="border-t border-slate-200 pt-2 flex items-center justify-between text-[9px] text-slate-500">
          <span>Official Computer Generated Voucher • Azizi Typing &amp; Stamp Making Br. 1</span>
          <span>Musaffah M37, Abu Dhabi • 0542797933</span>
        </div>

      </div>
    </div>
  );
};
