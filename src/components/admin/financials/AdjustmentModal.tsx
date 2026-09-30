import React, { useState } from 'react';
import { useAppStore } from '../../../store/useAppStore';
import { X, BadgePercent, AlertCircle, CheckCircle2 } from 'lucide-react';

interface Props {
  initialTenantNationalId?: string;
  initialLeaseId?: string;
  onClose: () => void;
  onSuccess?: () => void;
}

export const AdjustmentModal: React.FC<Props> = ({
  initialTenantNationalId,
  initialLeaseId,
  onClose,
  onSuccess,
}) => {
  const { state, createTenantAdjustment } = useAppStore();
  const [leaseId, setLeaseId] = useState<string>(initialLeaseId || state.leases[0]?.id || '');
  const [type, setType] = useState<'discount' | 'waiver' | 'compensation' | 'reversal'>('discount');
  const [amount, setAmount] = useState<number>(500);
  const [reason, setReason] = useState<string>('تخفيض ترحيبي معتمد للعميل');
  const [authorizedBy, setAuthorizedBy] = useState<string>('أحمد المفلح (مدير العمليات)');
  const [appliedToInstallmentId, setAppliedToInstallmentId] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const selectedLease = state.leases.find(l => l.id === leaseId);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLease) return;
    setErrorMsg(null);
    try {
      createTenantAdjustment({
        leaseId,
        tenantNationalId: selectedLease.tenant.nationalIdOrPassport,
        type,
        amount,
        reason,
        authorizedBy,
        appliedToInstallmentId: appliedToInstallmentId || undefined,
      });
      if (onSuccess) onSuccess();
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'حدث خطأ أثناء حفظ التسوية.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-lg rounded-3xl border border-[#E3DCCD] shadow-2xl overflow-hidden text-xs text-right">
        <div className="p-5 border-b border-[#E3DCCD] flex items-center justify-between bg-[#FAF8F5]">
          <div className="flex items-center gap-2">
            <BadgePercent className="w-5 h-5 text-amber-600" />
            <div>
              <h3 className="text-sm font-bold text-[#282824]">إجراء خصم أو إعفاء مالي للنزيل</h3>
              <p className="text-[11px] text-[#68675F] block">
                تطبيق تعديل مالي مباشر لتخفيض قيمة الالتزام المستحق على قسط إيجاري محدد
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-[#E3DCCD]/50 rounded-xl cursor-pointer">
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
            <label className="block text-[11px] font-bold text-[#282824] mb-1">اختر عقد المستأجر المشمول بالخصم</label>
            <select
              value={leaseId}
              onChange={(e) => setLeaseId(e.target.value)}
              className="w-full bg-[#FAF8F5] border border-[#E3DCCD] rounded-xl px-3 py-2 text-xs font-semibold cursor-pointer"
            >
              {state.leases.map(l => (
                <option key={l.id} value={l.id}>
                  العقد رقم #{l.contractNumber} - المستأجر: {l.tenant.fullName}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-[#282824] mb-1">نوع الحركة التسوية المالية</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as any)}
                className="w-full bg-[#FAF8F5] border border-[#E3DCCD] rounded-xl px-3 py-2 text-xs cursor-pointer"
              >
                <option value="discount">خصم مالي ترويجي (Discount)</option>
                <option value="waiver">إعفاء مالي خاص (Waiver)</option>
                <option value="compensation">تعويض عن عطل تشغيلي</option>
                <option value="reversal">عكس قيد تسوية</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-bold text-[#282824] mb-1">قيمة الخصم / التسوية (ر.س) *</label>
              <input
                type="number"
                min="1"
                step="any"
                value={amount}
                onChange={(e) => setAmount(Number(e.target.value))}
                className="w-full bg-white border border-amber-300 rounded-xl px-3 py-2 text-sm font-black text-[#282824] text-left focus:outline-none"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-[#282824] mb-1">تطبيق وتخفيض قسط محدد (اختياري)</label>
            <select
              value={appliedToInstallmentId}
              onChange={(e) => setAppliedToInstallmentId(e.target.value)}
              className="w-full bg-[#FAF8F5] border border-[#E3DCCD] rounded-xl px-3 py-2 text-xs cursor-pointer"
            >
              <option value="">-- تسوية عامة على كشف الحساب الإجمالي --</option>
              {selectedLease?.installments.filter(i => i.remainingAmount > 0).map(i => (
                <option key={i.id} value={i.id}>
                  {i.label || `الدفعة رقم #${i.installmentNumber}`} (المتبقي: {i.remainingAmount} ر.س | الاستحقاق: {i.dueDate})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-[#282824] mb-1">مبرر وسبب الخصم المعتمد بالتفصيل</label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="اكتب مبررات الصرف بالتفصيل لغايات الامتثال والأرشفة..."
              className="w-full bg-[#FAF8F5] border border-[#E3DCCD] rounded-xl px-3 py-2 text-xs text-right focus:outline-none focus:border-[#B69A68]"
              required
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-[#282824] mb-1">صاحب الصلاحية المعتمد للإعفاء</label>
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
              className="px-5 py-2 bg-[#282824] hover:bg-[#1A1A17] text-white rounded-xl font-bold flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              <span>تأكيد اعتماد وحفظ التسوية</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
