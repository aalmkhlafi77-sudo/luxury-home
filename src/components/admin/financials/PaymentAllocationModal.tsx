import React, { useState, useMemo } from 'react';
import { useAppStore } from '../../../store/useAppStore';
import { X, CreditCard, AlertCircle, CheckCircle2 } from 'lucide-react';
import { CurrencyAmount, formatNumber } from '../../../utils/formatters';

interface Props {
  initialTenantNationalId?: string;
  initialLeaseId?: string;
  onClose: () => void;
  onSuccess?: () => void;
}

export const PaymentAllocationModal: React.FC<Props> = ({
  initialTenantNationalId,
  initialLeaseId,
  onClose,
  onSuccess,
}) => {
  const { state, recordPaymentAndAllocate } = useAppStore();
  const [tenantNationalId, setTenantNationalId] = useState<string>(initialTenantNationalId || '');
  const [amount, setAmount] = useState<number>(0);
  const [method, setMethod] = useState<'mada' | 'visa_mastercard' | 'apple_pay' | 'bank_transfer' | 'cash'>('bank_transfer');
  const [receiptNumber, setReceiptNumber] = useState<string>(`RCP-${Date.now().toString().slice(-6)}`);
  const [notes, setNotes] = useState<string>('تحصيل دفعة مالية وإصدار سند قبض رسمي');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Allocations mapping: installmentId -> amount
  const [allocationsMap, setAllocationsMap] = useState<Record<string, number>>({});

  // Get tenant leases & installments
  const tenantLeases = useMemo(() => {
    if (!tenantNationalId) return [];
    return (state.leases || []).filter(l =>
      l.tenant.nationalIdOrPassport === tenantNationalId || l.id === initialLeaseId
    );
  }, [state.leases, tenantNationalId, initialLeaseId]);

  // List of unpaid/partially paid installments
  const pendingInstallments = useMemo(() => {
    const list: {
      leaseId: string;
      contractNumber: string;
      unitNumber: string;
      installment: any;
    }[] = [];
    tenantLeases.forEach(lease => {
      const unit = state.units.find(u => u.id === lease.unitId);
      (lease.installments || []).forEach(inst => {
        if (inst.remainingAmount > 0) {
          list.push({
            leaseId: lease.id,
            contractNumber: lease.contractNumber,
            unitNumber: unit?.unitNumber || lease.unitId,
            installment: inst,
          });
        }
      });
    });
    return list;
  }, [tenantLeases, state.units]);

  // Total allocated amount
  const totalAllocated = useMemo(() => {
    return Object.values(allocationsMap).reduce((sum, val) => sum + (val || 0), 0);
  }, [allocationsMap]);

  // Surplus / unallocated credit
  const unallocatedCredit = Math.max(0, amount - totalAllocated);

  const handleAllocationChange = (instId: string, val: number, maxAmount: number) => {
    const clamped = Math.min(Math.max(0, val), maxAmount);
    setAllocationsMap(prev => ({
      ...prev,
      [instId]: clamped,
    }));
  };

  const handleAutoDistribute = () => {
    let remainingToDistribute = amount;
    const newMap: Record<string, number> = {};
    for (const item of pendingInstallments) {
      if (remainingToDistribute <= 0) break;
      const needed = item.installment.remainingAmount;
      const alloc = Math.min(needed, remainingToDistribute);
      newMap[item.installment.id] = alloc;
      remainingToDistribute -= alloc;
    }
    setAllocationsMap(newMap);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    if (amount <= 0) {
      setErrorMsg('المبلغ المدفوع يجب أن يكون أكبر من الصفر.');
      return;
    }
    if (totalAllocated > amount) {
      setErrorMsg(`تعذر توزيع الرصيد، المبالغ الموزعة المستهدفة للأقساط (${totalAllocated} ر.س) تفوق إجمالي قيمة الدفعة المدفوعة (${amount} ر.س)`);
      return;
    }

    const tenant = tenantLeases[0]?.tenant;
    const tenantName = tenant?.fullName || 'مستأجر غير معروف';

    // Build allocation payload
    const finalAllocations: {
      leaseId: string;
      installmentId?: string;
      targetType: 'installment' | 'service_fee' | 'damage_claim';
      amount: number;
    }[] = [];

    Object.entries(allocationsMap).forEach(([instId, allocAmt]) => {
      if (allocAmt > 0) {
        const item = pendingInstallments.find(p => p.installment.id === instId);
        if (item) {
          finalAllocations.push({
            leaseId: item.leaseId,
            installmentId: instId,
            targetType: 'installment',
            amount: allocAmt,
          });
        }
      }
    });

    try {
      recordPaymentAndAllocate({
        amount,
        method,
        tenantNationalId: tenantNationalId || (tenant?.nationalIdOrPassport || ''),
        tenantName,
        receiptNumber,
        notes,
        allocations: finalAllocations,
        performedBy: 'أمين الصندوق والتحصيل'
      });
      if (onSuccess) onSuccess();
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'حدث خطأ أثناء حفظ قيد السداد.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-2xl rounded-3xl border border-[#E3DCCD] shadow-2xl overflow-hidden text-xs flex flex-col max-h-[90vh] text-right">
        
        {/* Header */}
        <div className="p-5 border-b border-[#E3DCCD] flex items-center justify-between bg-[#FAF8F5]">
          <div className="flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-[#B69A68]" />
            <div>
              <h3 className="text-sm font-bold text-[#282824]">تحصيل دفعة مالية وإصدار سند قبض</h3>
              <p className="text-[11px] text-[#68675F] block">
                توزيع المبالغ يدوياً أو تلقائياً على الأقساط المتبقية وحفظ الفائض كرصيد دائن متاح بالحساب
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-[#E3DCCD]/50 rounded-xl text-[#68675F] hover:text-[#282824] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto flex-1">
          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 flex items-center gap-2 text-right">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Payment Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-bold text-[#282824] mb-1">اختر المستأجر المعني *</label>
              <select
                value={tenantNationalId}
                onChange={(e) => setTenantNationalId(e.target.value)}
                className="w-full bg-[#FAF8F5] border border-[#E3DCCD] rounded-xl px-3 py-2 text-xs font-semibold cursor-pointer"
                required
              >
                <option value="">-- اختر مستأجر من القائمة --</option>
                {state.leases.map(l => (
                  <option key={l.id} value={l.tenant.nationalIdOrPassport}>
                    {l.tenant.fullName} ({l.tenant.nationalIdOrPassport})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-bold text-[#282824] mb-1">مبلغ السداد المستلم (ر.س) *</label>
              <input
                type="number"
                min="1"
                step="any"
                value={amount || ''}
                onChange={(e) => setAmount(Number(e.target.value))}
                placeholder="0.00"
                className="w-full bg-white border border-[#B69A68] rounded-xl px-3 py-2 text-sm font-black text-[#282824] text-left focus:outline-none"
                required
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-[#282824] mb-1">وسيلة السداد</label>
              <select
                value={method}
                onChange={(e) => setMethod(e.target.value as any)}
                className="w-full bg-[#FAF8F5] border border-[#E3DCCD] rounded-xl px-3 py-2 text-xs cursor-pointer"
              >
                <option value="bank_transfer">حوالة مصرفية رسمية</option>
                <option value="mada">بطاقة مدى mada البنكية</option>
                <option value="visa_mastercard">فيزا / ماستركارد</option>
                <option value="apple_pay">Apple Pay</option>
                <option value="cash">نقداً لدى الصندوق</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-bold text-[#282824] mb-1">رقم سند القبض (تلقائي)</label>
              <input
                type="text"
                value={receiptNumber}
                onChange={(e) => setReceiptNumber(e.target.value)}
                className="w-full bg-[#FAF8F5] border border-[#E3DCCD] rounded-xl px-3 py-2 text-xs font-mono select-all focus:outline-none"
                required
              />
            </div>
          </div>

          {/* Allocation Section */}
          <div className="pt-3 border-t border-[#E3DCCD] space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-bold text-[#282824] text-xs">توزيع المبالغ على الأقساط المستحقة:</span>
              {amount > 0 && pendingInstallments.length > 0 && (
                <button
                  type="button"
                  onClick={handleAutoDistribute}
                  className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 rounded-lg text-[10px] font-bold cursor-pointer"
                >
                  توزيع تلقائي كرونولوجي
                </button>
              )}
            </div>

            {pendingInstallments.length === 0 ? (
              <div className="p-4 bg-[#FAF8F5] rounded-2xl text-center text-[#68675F] text-xs">
                لا توجد أقساط مالية مستحقة السداد حالياً لهذا العميل. سيتم حفظ كامل المبلغ كرصيد دائن متاح بالحساب.
              </div>
            ) : (
              <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                {pendingInstallments.map(item => {
                  const inst = item.installment;
                  const allocated = allocationsMap[inst.id] || 0;
                  return (
                    <div
                      key={inst.id}
                      className="p-3 bg-[#FAF8F5] rounded-xl border border-[#E3DCCD] flex items-center justify-between gap-3 text-right"
                    >
                      <div className="flex-1">
                        <div className="font-bold text-[#282824] text-xs">
                          {inst.label || `الدفعة #${inst.installmentNumber}`} - {item.contractNumber} (شقة #{item.unitNumber})
                        </div>
                        <div className="text-[10px] text-[#68675F] flex items-center gap-2 mt-0.5 justify-start">
                          <span>الاستحقاق: {inst.dueDate}</span>
                          <span>·</span>
                          <span>القيمة: {inst.amount} ر.س</span>
                          <span>·</span>
                          <span className="text-rose-700 font-semibold">المتبقي: {inst.remainingAmount} ر.س</span>
                        </div>
                      </div>
                      <div className="w-32 flex items-center gap-1.5">
                        <input
                          type="number"
                          min="0"
                          max={inst.remainingAmount}
                          value={allocated || ''}
                          onChange={(e) => handleAllocationChange(inst.id, Number(e.target.value), inst.remainingAmount)}
                          placeholder="0"
                          className="w-full bg-white border border-[#E3DCCD] rounded-lg px-2 py-1 text-xs text-left font-bold"
                        />
                        <span className="text-[10px] text-[#68675F]">ر.س</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Allocation Totals Summary */}
            <div className="p-3 bg-[#F7F3EB] rounded-2xl border border-[#E3DCCD] flex items-center justify-between text-xs">
              <div className="space-y-0.5 text-right">
                <div className="flex items-center gap-1">
                  <span>إجمالي المبلغ الموزع والمخصص:</span>
                  <div className="text-[#282824] font-bold">
                    <CurrencyAmount amount={totalAllocated} />
                  </div>
                </div>
                {unallocatedCredit > 0 && (
                  <div className="text-indigo-800 text-[11px] font-bold flex items-center gap-1">
                    <span>الرصيد الدائن الفائض (المحفوظ كائتمان):</span>
                    <CurrencyAmount amount={unallocatedCredit} />
                  </div>
                )}
              </div>
              <div className="text-left font-bold">
                {totalAllocated > amount ? (
                  <span className="text-rose-700 text-xs">المبلغ الموزع يفوق المدفوع!</span>
                ) : (
                  <span className="text-emerald-700 text-xs flex items-center gap-1">
                    ✓ التخصيص سليم ومتطابق
                  </span>
                )}
              </div>
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-[#282824] mb-1">بيانات تتبع التحصيل وملاحظات إضافية</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full bg-[#FAF8F5] border border-[#E3DCCD] rounded-xl px-3 py-2 text-xs text-right focus:outline-none focus:border-[#B69A68]"
            />
          </div>

          {/* Action Buttons */}
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
              <span>تسجيل سداد وتحصيل السند</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
