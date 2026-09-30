import React, { useState } from 'react';
import { useAppStore } from '../../../store/useAppStore';
import { X, ShieldAlert, AlertCircle, CheckCircle2 } from 'lucide-react';

interface Props {
  initialDepositId?: string;
  initialLeaseId?: string;
  onClose: () => void;
  onSuccess?: () => void;
}

export const DepositSettlementModal: React.FC<Props> = ({
  initialDepositId,
  initialLeaseId,
  onClose,
  onSuccess,
}) => {
  const { state, settleSecurityDepositAgainstRent } = useAppStore();
  const [depositId, setDepositId] = useState<string>(initialDepositId || state.securityDeposits[0]?.id || '');
  const [installmentId, setInstallmentId] = useState<string>('');
  const [amount, setAmount] = useState<number>(0);
  const [reason, setReason] = useState<string>('اقتطاع وديعة التأمين لتغطية المستحقات المتأخرة بالاتفاق');
  const [authorizedBy, setAuthorizedBy] = useState<string>('سعد القحطاني (مدير التحصيل)');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const selectedDeposit = state.securityDeposits.find(d => d.id === depositId);
  const totalDeducted = (selectedDeposit?.deductions || []).reduce((s, x) => s + x.amount, 0);
  const availableDeposit = selectedDeposit ? Math.max(0, selectedDeposit.amount - totalDeducted) : 0;

  // Find target lease
  const targetLease = state.leases.find(l => l.id === selectedDeposit?.bookingOrLeaseId || l.id === initialLeaseId);
  const pendingInstallments = targetLease?.installments.filter(i => i.remainingAmount > 0) || [];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDeposit || !targetLease) return;
    setErrorMsg(null);
    if (amount <= 0) {
      setErrorMsg('المبلغ المطلوب تسويته يجب أن يكون أكبر من الصفر.');
      return;
    }
    if (amount > availableDeposit) {
      setErrorMsg(`تعذر إتمام التسوية، المبلغ الموزع أكبر من رصيد التأمين المحتجز المتاح وهو (${availableDeposit} ر.س)`);
      return;
    }
    if (!installmentId) {
      setErrorMsg('يرجى اختيار الدفعة المستحقة المستهدفة بالسداد.');
      return;
    }

    try {
      settleSecurityDepositAgainstRent({
        depositId,
        leaseId: targetLease.id,
        installmentId,
        amount,
        reason,
        authorizedBy,
      });
      if (onSuccess) onSuccess();
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'حدث خطأ أثناء إجراء قيد التسوية والاقتطاع.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-lg rounded-3xl border border-[#E3DCCD] shadow-2xl overflow-hidden text-xs text-right">
        
        {/* Header */}
        <div className="p-5 border-b border-[#E3DCCD] flex items-center justify-between bg-amber-50">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-amber-700" />
            <div>
              <h3 className="text-sm font-bold text-amber-950">تسوية واقتطاع من مبلغ تأمين السكن</h3>
              <p className="text-[11px] text-amber-800">
                تسوية واقتطاع وديعة التأمين الأمنية المعزولة لسداد المتأخرات الإيجارية أو التلفيات الموثقة
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-amber-200/50 rounded-xl cursor-pointer">
            <X className="w-4 h-4 text-[#68675F]" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 flex items-center gap-2 text-right">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div>
            <label className="block text-[11px] font-bold text-[#282824] mb-1">اختر وديعة التأمين المعلقة الصالحة</label>
            <select
              value={depositId}
              onChange={(e) => setDepositId(e.target.value)}
              className="w-full bg-[#FAF8F5] border border-[#E3DCCD] rounded-xl px-3 py-2 text-xs font-semibold cursor-pointer"
            >
              {state.securityDeposits.filter(d => d.status === 'held').map(d => (
                <option key={d.id} value={d.id}>
                  {d.guestName} - وديعة #{d.id} (المتاح: {d.amount - d.deductions.reduce((s, x) => s + x.amount, 0)} ر.س)
                </option>
              ))}
            </select>
          </div>

          <div className="p-3 bg-[#FAF8F5] rounded-2xl border border-[#E3DCCD] flex items-center justify-between">
            <span className="text-[11px] text-[#68675F]">رصيد التأمين الأمني المتاح للاقتطاع:</span>
            <span className="text-base font-black text-amber-950 tabular-nums">{availableDeposit.toLocaleString('ar-SA')} ر.س</span>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-[#282824] mb-1">توجيه وسداد القسط الإيجاري المستهدف</label>
            <select
              value={installmentId}
              onChange={(e) => {
                setInstallmentId(e.target.value);
                const inst = pendingInstallments.find(i => i.id === e.target.value);
                if (inst) {
                  setAmount(Math.min(inst.remainingAmount, availableDeposit));
                }
              }}
              className="w-full bg-[#FAF8F5] border border-[#E3DCCD] rounded-xl px-3 py-2 text-xs cursor-pointer"
              required
            >
              <option value="">-- اختر قسط متأخر من القائمة للتغطية --</option>
              {pendingInstallments.map(i => (
                <option key={i.id} value={i.id}>
                  {i.label || `الدفعة رقم #${i.installmentNumber}`} (المستحق: {i.remainingAmount} ر.س | الموعد: {i.dueDate})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-[#282824] mb-1">المبلغ المراد اقتطاعه وتسويته (ر.س) *</label>
            <input
              type="number"
              min="1"
              max={availableDeposit}
              step="any"
              value={amount || ''}
              onChange={(e) => setAmount(Number(e.target.value))}
              className="w-full bg-white border border-amber-300 rounded-xl px-3 py-2 text-sm font-black text-[#282824] text-left focus:outline-none"
              required
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-[#282824] mb-1">سبب ومبرر تسوية التأمين المعتمد</label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full bg-[#FAF8F5] border border-[#E3DCCD] rounded-xl px-3 py-2 text-xs text-right focus:outline-none focus:border-[#B69A68]"
              required
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-[#282824] mb-1">المسؤول المعتمد للتسوية الإدارية</label>
            <input
              type="text"
              value={authorizedBy}
              onChange={(e) => setAuthorizedBy(e.target.value)}
              className="w-full bg-[#FAF8F5] border border-[#E3DCCD] rounded-xl px-3 py-2 text-xs text-right focus:outline-none focus:border-[#B69A68]"
              required
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#E3DCCD]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-[#F7F3EB] text-[#282824] rounded-xl font-medium cursor-pointer"
            >
              تراجع وإلغاء
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-amber-800 hover:bg-amber-900 text-white rounded-xl font-bold flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              <span>تأكيد اقتطاع رصيد التأمين</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
