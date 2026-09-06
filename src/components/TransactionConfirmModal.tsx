import React, { useEffect } from 'react';
import {
  AlertCircle,
  ArrowDown,
  ArrowRightLeft,
  CheckCircle2,
  CreditCard,
  Landmark,
  ReceiptText,
  RotateCcw,
  Wallet,
  X
} from 'lucide-react';

export interface ConfirmDetailItem {
  label: string;
  value: React.ReactNode;
  badge?: boolean;
  highlight?: boolean;
  badgeColor?: 'emerald' | 'amber' | 'rose' | 'sky' | 'indigo' | 'slate';
}

export interface TransferFlowInfo {
  fromAccountName?: string;
  fromCurrentBalance?: number;
  fromNewBalance?: number;
  toAccountName: string;
  toCurrentBalance: number;
  toNewBalance: number;
}

export interface TransactionConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  subtitle?: string;
  type?: 'transfer' | 'payment' | 'refund' | 'expense' | 'sale' | 'generic';
  amount?: number;
  currency?: string;
  confirmText?: string;
  cancelText?: string;
  loading?: boolean;
  details?: ConfirmDetailItem[];
  transferFlow?: TransferFlowInfo;
  warningMessage?: string;
}

export const TransactionConfirmModal: React.FC<TransactionConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  subtitle,
  type = 'generic',
  amount,
  currency = 'AED',
  confirmText = 'Confirm',
  cancelText = 'Back to Edit',
  loading = false,
  details = [],
  transferFlow,
  warningMessage
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !loading) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, loading, onClose]);

  if (!isOpen) return null;

  const getTypeIcon = () => {
    switch (type) {
      case 'transfer':
        return <ArrowRightLeft size={18} className="text-primary" />;
      case 'payment':
        return <CreditCard size={18} className="text-emerald-600" />;
      case 'refund':
        return <RotateCcw size={18} className="text-rose-600" />;
      case 'expense':
        return <Landmark size={18} className="text-amber-600" />;
      case 'sale':
        return <ReceiptText size={18} className="text-primary" />;
      default:
        return <CheckCircle2 size={18} className="text-primary" />;
    }
  };

  const getBadgeStyle = (color?: string) => {
    switch (color) {
      case 'emerald':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'amber':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'rose':
        return 'bg-rose-50 text-rose-700 border-rose-200';
      case 'sky':
        return 'bg-sky-50 text-sky-700 border-sky-200';
      case 'indigo':
        return 'bg-indigo-50 text-indigo-700 border-indigo-200';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div 
        className="bg-white border border-slate-200 rounded-2xl shadow-2xl max-w-md w-full overflow-hidden flex flex-col max-h-[92vh] text-slate-900 animate-in zoom-in-95 duration-150"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-slate-50/70">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-primary/10 border border-primary/20 shrink-0">
              {getTypeIcon()}
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base m-0 leading-tight">
                {title}
              </h3>
              {subtitle && (
                <p className="text-xs text-slate-500 mt-0.5 m-0 leading-tight">
                  {subtitle}
                </p>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors cursor-pointer disabled:opacity-50"
          >
            <X size={17} />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 space-y-3.5 overflow-y-auto flex-1 text-xs">
          
          {/* Main Amount Card */}
          {amount !== undefined && (
            <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-between gap-3">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-0.5">
                  {type === 'transfer' ? 'Transfer Amount' : type === 'refund' ? 'Refund Amount' : type === 'expense' ? 'Expense Amount' : 'Total Amount'}
                </span>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-2xl font-black font-mono text-slate-900 tracking-tight leading-none">
                    {amount.toFixed(2)}
                  </span>
                  <span className="text-xs font-bold font-sans text-slate-600">
                    {currency}
                  </span>
                </div>
              </div>
              <div className="p-2 rounded-xl bg-white border border-slate-200 text-slate-600 shadow-2xs">
                <Wallet size={18} />
              </div>
            </div>
          )}

          {/* Dedicated Visual Transfer Flow (From ➔ To) */}
          {transferFlow && (
            <div className="space-y-2">
              {/* FROM CARD */}
              <div className="bg-white p-3.5 rounded-xl border border-rose-200 space-y-1 shadow-2xs">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-bold text-rose-600 uppercase tracking-wide">
                    From (Cash Out)
                  </span>
                  <span className="font-mono text-slate-500 font-medium text-[11px]">
                    Current: <strong>{Number(transferFlow.fromCurrentBalance || 0).toFixed(2)} AED</strong>
                  </span>
                </div>

                <div className="font-bold text-sm text-slate-900">
                  {transferFlow.fromAccountName || 'Direct External Deposit'}
                </div>

                {transferFlow.fromAccountName && transferFlow.fromNewBalance !== undefined && (
                  <div className="text-[11px] text-slate-600 flex items-center justify-between pt-1 border-t border-rose-100">
                    <span>New Balance After Transfer:</span>
                    <span className="font-mono font-bold text-rose-600 text-xs">
                      {transferFlow.fromNewBalance.toFixed(2)} AED
                    </span>
                  </div>
                )}
              </div>

              {/* ARROW INDICATOR */}
              <div className="flex justify-center -my-1">
                <div className="w-6 h-6 rounded-full bg-slate-900 text-white flex items-center justify-center shadow-xs">
                  <ArrowDown size={13} />
                </div>
              </div>

              {/* TO CARD */}
              <div className="bg-white p-3.5 rounded-xl border border-emerald-200 space-y-1 shadow-2xs">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-bold text-emerald-600 uppercase tracking-wide">
                    To (Cash In)
                  </span>
                  <span className="font-mono text-slate-500 font-medium text-[11px]">
                    Current: <strong>{Number(transferFlow.toCurrentBalance || 0).toFixed(2)} AED</strong>
                  </span>
                </div>

                <div className="font-bold text-sm text-slate-900">
                  {transferFlow.toAccountName}
                </div>

                <div className="text-[11px] text-slate-600 flex items-center justify-between pt-1 border-t border-emerald-100">
                  <span>New Balance After Transfer:</span>
                  <span className="font-mono font-bold text-emerald-600 text-xs">
                    {transferFlow.toNewBalance.toFixed(2)} AED
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Warning banner if present */}
          {warningMessage && (
            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 flex items-start gap-2 text-xs">
              <AlertCircle size={15} className="shrink-0 mt-0.5 text-amber-600" />
              <span className="font-medium leading-relaxed">{warningMessage}</span>
            </div>
          )}

          {/* Details Breakdown Table (if items provided) */}
          {details.length > 0 && (
            <div className="border border-slate-200 rounded-xl overflow-hidden bg-white divide-y divide-slate-100 shadow-2xs">
              {details.map((item, idx) => (
                <div key={idx} className="flex items-start justify-between p-2.5 hover:bg-slate-50/80 transition-colors gap-3">
                  <span className="text-slate-500 font-medium text-xs shrink-0">
                    {item.label}
                  </span>
                  <div className="text-right font-bold text-xs text-slate-900 max-w-[70%] break-words">
                    {item.badge ? (
                      <span className={`inline-block px-2 py-0.5 rounded-md border text-[11px] font-bold ${getBadgeStyle(item.badgeColor)}`}>
                        {item.value}
                      </span>
                    ) : item.highlight ? (
                      <span className="font-black text-primary font-mono text-sm">
                        {item.value}
                      </span>
                    ) : (
                      <span>{item.value}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

        </div>

        {/* Action Footer */}
        <div className="flex items-center justify-end gap-2.5 px-5 py-3.5 border-t border-slate-100 bg-slate-50/70">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-200 transition-colors cursor-pointer disabled:opacity-50"
          >
            {cancelText}
          </button>

          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-primary hover:bg-primary-hover text-white text-xs font-bold transition-all shadow-xs cursor-pointer disabled:opacity-50"
          >
            {loading ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Processing...</span>
              </>
            ) : (
              <>
                <CheckCircle2 size={14} />
                <span>{confirmText}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
