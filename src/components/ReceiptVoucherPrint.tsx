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

export const ReceiptVoucherPrint: React.FC<{ data: PrintableVoucherData | null }> = ({ data }) => {
  if (!data) return null;

  const isReceipt = data.type === 'receipt';
  const custName = data.sale?.customer?.name || data.sale?.sale_customer_name || 'Walk-in Customer';
  const compName = data.sale?.customer?.company?.name || data.sale?.sale_customer_company_name;

  const rawPerson = data.personName?.trim();
  const invoiceMemberName =
    (rawPerson && rawPerson !== '') ? rawPerson :
    (data.sale?.person_name?.trim() ||
    data.sale?.items?.find((i: any) => i.person_name?.trim())?.person_name?.trim() ||
    (data.reason && data.reason.match(/\[Member:\s*([^\]]+)\]/)?.[1]?.trim()) ||
    undefined);

  const isDistinctMember = Boolean(
    invoiceMemberName &&
    invoiceMemberName !== '' &&
    invoiceMemberName.toLowerCase() !== custName.toLowerCase() &&
    (!compName || invoiceMemberName.toLowerCase() !== compName.toLowerCase())
  );

  return (
    <div className="hidden print:block fixed inset-0 bg-white text-black p-6 sm:p-8 font-sans text-xs print-voucher-sheet">
      <div className="max-w-3xl mx-auto border-2 border-[#000ba0] p-6 rounded-xl space-y-4 bg-white">
        
        {/* 1. Header */}
        <div className="flex items-center justify-between border-b-2 border-gray-200 pb-3">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="AZIZI" className="w-16 h-16 object-contain" />
            <div>
              <div className="text-base font-black text-[#000ba0] leading-tight" style={{ fontFamily: "'Cairo', 'Inter', sans-serif" }}>
                مكتب عزيزي للكتابة وعمل الأختام ذ.م.م - فرع ۱
              </div>
              <div className="text-xs font-black text-[#f28f00] tracking-wider uppercase">
                AZIZI TYPING &amp; STAMP MAKING BR. 1
              </div>
              <div className="text-[10px] text-gray-600 font-semibold mt-0.5">
                Musaffah M37, Abu Dhabi, UAE • Tel: 0542797933 • azizitypingbr@gmail.com
              </div>
            </div>
          </div>
          <div className="text-right">
            <div className={`px-3 py-1 text-white font-extrabold text-xs rounded uppercase tracking-wider ${
              isReceipt ? 'bg-[#000ba0]' : 'bg-[#be123c]'
            }`}>
              {isReceipt ? 'RECEIPT VOUCHER' : 'REFUND VOUCHER'}
            </div>
            <div className="text-[10px] text-gray-500 font-mono mt-1 font-bold">
              No: {data.voucherNo || (isReceipt ? `PAY-${Date.now().toString().slice(-6)}` : `REF-${Date.now().toString().slice(-6)}`)}
            </div>
          </div>
        </div>

        {/* 2. Banner / Title in Arabic & English */}
        <div className={`py-1.5 px-4 text-center font-black tracking-wide text-xs rounded text-white ${
          isReceipt ? 'bg-[#000ba0]' : 'bg-[#be123c]'
        }`}>
          {isReceipt 
            ? 'OFFICIAL PAYMENT RECEIPT VOUCHER • سند قبض رسمي' 
            : 'OFFICIAL PAYMENT RETURN & REFUND VOUCHER • سند صرف واسترجاع'}
        </div>

        {/* 3. Voucher Main Info Grid */}
        <table className="w-full border-collapse border border-gray-300 text-xs">
          <tbody>
            <tr className="border-b border-gray-300">
              <td className="p-2 bg-gray-50 font-bold text-gray-700 w-1/4 border-r border-gray-300">
                Date &amp; Time:
              </td>
              <td className="p-2 font-semibold text-black w-1/4 border-r border-gray-300">
                {new Date(data.date).toLocaleString([], { dateStyle: 'short', timeStyle: 'medium' })}
              </td>
              <td className="p-2 bg-gray-50 font-bold text-gray-700 w-1/4 border-r border-gray-300">
                Invoice Reference #:
              </td>
              <td className="p-2 font-mono font-bold text-[#000ba0] w-1/4">
                {data.sale?.invoice_no ? `#${data.sale.invoice_no}` : (data.sale?.invoice_no || '—')}
              </td>
            </tr>

            <tr className="border-b border-gray-300">
              <td className="p-2 bg-gray-50 font-bold text-gray-700 border-r border-gray-300">
                {isReceipt ? 'Received From:' : 'Paid / Returned To:'}
              </td>
              <td className="p-2 font-bold text-black border-r border-gray-300" colSpan={isDistinctMember ? 1 : 3}>
                {custName}
                {compName && compName.toLowerCase() !== custName.toLowerCase() && (
                  <span className="text-[11px] text-gray-600 block font-semibold">({compName})</span>
                )}
              </td>
              {isDistinctMember && (
                <>
                  <td className="p-2 bg-gray-50 font-bold text-gray-700 border-r border-gray-300">
                    For Member / Applicant:
                  </td>
                  <td className="p-2 font-bold text-black">
                    {invoiceMemberName}
                  </td>
                </>
              )}
            </tr>

            <tr className="border-b border-gray-300">
              <td className="p-2 bg-gray-50 font-bold text-gray-700 border-r border-gray-300">
                Payment Mode:
              </td>
              <td className="p-2 font-bold text-black border-r border-gray-300" colSpan={data.transactionNo ? 1 : 3}>
                {data.paymentMethod || 'Cash'}
              </td>
              {data.transactionNo && (
                <>
                  <td className="p-2 bg-gray-50 font-bold text-gray-700 border-r border-gray-300">
                    Transaction / Ref No:
                  </td>
                  <td className="p-2 font-mono font-bold text-black">
                    {data.transactionNo}
                  </td>
                </>
              )}
            </tr>

            <tr className="border-b border-gray-300">
              <td className="p-2 bg-gray-50 font-bold text-gray-700 border-r border-gray-300">
                {isReceipt ? 'Payment Remarks / Purpose:' : 'Reason for Refund:'}
              </td>
              <td className="p-2 italic text-gray-900" colSpan={3}>
                {data.reason || (isReceipt ? `Payment collected against invoice #${data.sale?.invoice_no || ''}` : 'Application cancellation / fee return')}
              </td>
            </tr>
          </tbody>
        </table>

        {/* 4. Amount Highlight Box */}
        <div className={`p-4 rounded-xl border flex items-center justify-between ${
          isReceipt 
            ? 'bg-emerald-50 border-emerald-300 text-emerald-950' 
            : 'bg-rose-50 border-rose-300 text-rose-950'
        }`}>
          <div>
            <span className="text-[11px] uppercase font-black tracking-wider block">
              {isReceipt ? 'AMOUNT RECEIVED (المبلغ المستلم)' : 'AMOUNT REFUNDED (المبلغ المسترجع)'}
            </span>
            <span className="text-xs text-gray-600 font-medium italic">
              Currency: United Arab Emirates Dirham (AED)
            </span>
          </div>
          <div className="text-right">
            <span className="text-2xl font-black font-mono tracking-tight">
              {data.amount.toFixed(2)} AED
            </span>
          </div>
        </div>

        {/* 5. Signatures & Stamp Footer */}
        <div className="grid grid-cols-3 gap-4 pt-6 text-center text-xs">
          <div className="space-y-8">
            <span className="font-bold text-gray-700 block">Received By (Cashier)</span>
            <div className="border-t border-gray-400 pt-1 font-semibold text-gray-900">
              Authorized Cashier
            </div>
          </div>
          <div className="flex flex-col items-center justify-center">
            <div className="w-20 h-20 border-2 border-dashed border-gray-300 rounded-full flex items-center justify-center text-[9px] text-gray-400 font-bold uppercase">
              Official Stamp
            </div>
          </div>
          <div className="space-y-8">
            <span className="font-bold text-gray-700 block">Customer / Payer Signature</span>
            <div className="border-t border-gray-400 pt-1 font-semibold text-gray-900">
              Signature &amp; Date
            </div>
          </div>
        </div>

        {/* 6. Footer Note */}
        <div className="border-t border-gray-200 pt-2 text-center text-[9px] text-gray-500">
          Thank you for your business. Computer generated official voucher — Azizi Typing &amp; Stamp Making Br. 1
        </div>

      </div>
    </div>
  );
};
