import React, { useState } from 'react';
import { useAppStore } from '../../../store/useAppStore';
import { OperationalExpense } from '../../../types';
import {
  X,
  FileText,
  Building2,
  Calendar,
  CreditCard,
  CheckCircle2,
  AlertTriangle,
  History,
  Plus,
  RotateCcw,
  DollarSign,
  Layers,
  Sparkles,
  ExternalLink
} from 'lucide-react';
import {
  getExpenseCategoryLabel,
  getCostCenterLevelLabel,
  getTemporalDistributionLabel,
  getCostAllocationMethodLabel
} from '../../../utils/financialCalculations';
import { formatNumber, CurrencyAmount, formatDate } from '../../../utils/formatters';

interface Props {
  expense: OperationalExpense;
  onClose: () => void;
  onEditExpense: (exp: OperationalExpense) => void;
}

export const ExpenseDetailsModal: React.FC<Props> = ({
  expense,
  onClose,
  onEditExpense,
}) => {
  const { state, addExpensePayment, reverseExpense } = useAppStore();

  // Add Payment Sub-form
  const [showAddPayment, setShowAddPayment] = useState(false);
  const [payAmount, setPayAmount] = useState<number>(
    Math.max(0, expense.amount - expense.paidAmount)
  );
  const [payDate, setPayDate] = useState<string>(
    new Date().toISOString().slice(0, 10)
  );
  const [payMethod, setPayMethod] = useState<'bank_transfer' | 'company_card' | 'cash' | 'check'>('bank_transfer');
  const [payRef, setPayRef] = useState<string>('');

  // Reversal Sub-form
  const [showReverseForm, setShowReverseForm] = useState(false);
  const [reverseReason, setReverseReason] = useState<string>('');
  const [reversalSupervisor, setReversalSupervisor] = useState<string>('سعد القحطاني (مدير الإدارة المالية)');

  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const prop = state.properties.find(p => p.id === expense.propertyId);
  const unit = state.units.find(u => u.id === expense.unitId);

  const handleAddPaymentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    if (payAmount <= 0) {
      setErrorMsg('قيمة الدفعة يجب أن تكون أكبر من الصفر');
      return;
    }
    try {
      addExpensePayment(expense.id, {
        paymentDate: payDate,
        amount: payAmount,
        paymentMethod: payMethod,
        receiptReference: payRef,
        recordedBy: 'مشرف المالية والتشغيل',
      });
      setShowAddPayment(false);
      setPayRef('');
    } catch (err: any) {
      setErrorMsg(err.message || 'تعذر تسجيل الدفعة');
    }
  };

  const handleReverseSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    if (!reverseReason.trim()) {
      setErrorMsg('الرجاء توثيق سبب ومبرر عكس المصروف للتدقيق والرقابة المالية');
      return;
    }
    try {
      reverseExpense(expense.id, reversalSupervisor, reverseReason);
      setShowReverseForm(false);
    } catch (err: any) {
      setErrorMsg(err.message || 'تعذر عكس المصروف');
    }
  };

  const isReversed = expense.recordStatus === 'reversed';
  const remainingToPay = Math.max(0, expense.amount - expense.paidAmount);

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 text-right">
      <div className="bg-white w-full max-w-3xl rounded-3xl border border-[#E3DCCD] shadow-2xl overflow-hidden text-xs flex flex-col max-h-[92vh]">
        
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-[#E3DCCD] flex items-center justify-between bg-[#FAF8F5]">
          <div className="flex items-center gap-3">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold ${
              isReversed
                ? 'bg-rose-100 text-rose-800'
                : expense.isFfeOrEquipment
                ? 'bg-purple-100 text-purple-900'
                : 'bg-[#282824] text-[#B69A68]'
            }`}>
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm sm:text-base font-bold text-[#282824]">
                  تفاصيل وسجل قيد المصروف #{expense.expenseNumber}
                </h3>
                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                  isReversed
                    ? 'bg-rose-100 text-rose-800 border border-rose-200'
                    : expense.recordStatus === 'draft'
                    ? 'bg-amber-100 text-amber-800 border border-amber-200'
                    : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                }`}>
                  {isReversed ? 'معكوس وملغي' : expense.recordStatus === 'draft' ? 'مسودة' : 'معتمد'}
                </span>
                {expense.isFfeOrEquipment && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-900 border border-purple-200">
                    أصول ورأسمالي FF&E
                  </span>
                )}
              </div>
              <p className="text-[11px] text-[#68675F] mt-0.5">
                تاريخ التسجيل: {expense.date} · المسجل: {expense.createdBy}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-[#E3DCCD]/50 rounded-xl transition-colors cursor-pointer"
          >
            <X className="w-4 h-4 text-[#68675F]" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 sm:p-6 space-y-5 overflow-y-auto">
          
          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Reversal Banner if reversed */}
          {isReversed && expense.reversalInfo && (
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl space-y-1 select-none">
              <div className="flex items-center gap-2 text-rose-900 font-bold text-xs">
                <AlertTriangle className="w-4 h-4 text-rose-700" />
                <span>تم عكس هذا القيد المالي وإلغاؤه من تقارير التكاليف والربحية</span>
              </div>
              <p className="text-[11px] text-rose-800">
                المسؤول: <strong>{expense.reversalInfo.reversedBy}</strong> · التاريخ: {expense.reversalInfo.reversedAt.slice(0, 10)}
              </p>
              <p className="text-[11px] text-rose-800">
                سبب ومبرر العكس: <em>"{expense.reversalInfo.reason}"</em>
              </p>
            </div>
          )}

          {/* Summary Metric Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 select-none">
            <div className="bg-[#FAF8F5] p-3.5 rounded-2xl border border-[#E3DCCD]">
              <span className="text-[10px] text-[#68675F] block font-bold">إجمالي قيمة المصروف</span>
              <div className="text-lg font-black text-[#282824] block mt-0.5">
                <CurrencyAmount amount={expense.amount} />
              </div>
            </div>
            <div className="bg-emerald-50 p-3.5 rounded-2xl border border-emerald-200">
              <span className="text-[10px] text-emerald-800 block font-bold">المسدد فعلياً</span>
              <div className="text-lg font-black text-emerald-900 block mt-0.5">
                <CurrencyAmount amount={expense.paidAmount} />
              </div>
            </div>
            <div className={`p-3.5 rounded-2xl border ${
              remainingToPay > 0 ? 'bg-amber-50 border-amber-200' : 'bg-white border-[#E3DCCD]'
            }`}>
              <span className="text-[10px] text-[#68675F] block font-bold">المتبقي غير المسدد</span>
              <div className={`text-lg font-black block mt-0.5 ${
                remainingToPay > 0 ? 'text-amber-900' : 'text-[#282824]'
              }`}>
                <CurrencyAmount amount={remainingToPay} />
              </div>
            </div>
            <div className="bg-[#FAF8F5] p-3.5 rounded-2xl border border-[#E3DCCD]">
              <span className="text-[10px] text-[#68675F] block font-bold">حالة السداد</span>
              <span className={`text-xs font-bold block mt-1 ${
                expense.paymentStatus === 'paid' ? 'text-emerald-700' : expense.paymentStatus === 'partial' ? 'text-amber-700' : 'text-rose-700'
              }`}>
                {expense.paymentStatus === 'paid' ? 'مسدد بالكامل' : expense.paymentStatus === 'partial' ? 'سداد جزئي' : 'مستحق غير مسدد'}
              </span>
            </div>
          </div>

          {/* Description and Key Specs */}
          <div className="bg-white p-4 rounded-2xl border border-[#E3DCCD] space-y-3">
            <div>
              <span className="text-[10px] text-[#68675F] block font-bold">وصف وبند الصرف المستندي</span>
              <p className="text-xs text-[#282824] font-medium leading-relaxed mt-0.5">
                {expense.description}
              </p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-[#E3DCCD]/60 text-[11px]">
              <div>
                <span className="text-[#68675F] block text-[10px]">التصنيف الرئيسي:</span>
                <strong className="text-[#282824]">{getExpenseCategoryLabel(expense.category)}</strong>
              </div>
              <div>
                <span className="text-[#68675F] block text-[10px]">التصنيف الفرعي:</span>
                <strong className="text-[#282824]">{expense.subcategoryName || '-'}</strong>
              </div>
              <div>
                <span className="text-[#68675F] block text-[10px]">المورد / المستفيد:</span>
                <strong className="text-[#282824]">{expense.vendorOrBeneficiary}</strong>
              </div>
              <div>
                <span className="text-[#68675F] block text-[10px]">المستند المؤيد:</span>
                <strong className="text-[#282824] font-mono">{expense.invoiceDocNumber || '-'}</strong>
              </div>
            </div>
          </div>

          {/* Cost Center & Allocation Specs */}
          <div className="bg-[#FAF8F5] p-4 rounded-2xl border border-[#E3DCCD] space-y-3">
            <h4 className="font-bold text-[#282824] flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-[#B69A68]" />
              <span>مركز التكلفة وقواعد التوزيع المعتمدة</span>
            </h4>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-[11px]">
              <div>
                <span className="text-[#68675F] block text-[10px]">الجهة الأصلية:</span>
                <strong className="text-[#282824]">{getCostCenterLevelLabel(expense.level)}</strong>
              </div>
              <div>
                <span className="text-[#68675F] block text-[10px]">المبنى المعني:</span>
                <strong className="text-[#282824]">{prop?.name || (expense.level === 'company' ? 'كافة المجمعات' : '-')}</strong>
              </div>
              <div>
                <span className="text-[#68675F] block text-[10px]">الوحدة المباشرة:</span>
                <strong className="text-[#282824]">{unit ? `شقة #${unit.unitNumber}` : '-'}</strong>
              </div>
              <div>
                <span className="text-[#68675F] block text-[10px]">طريقة التوزيع:</span>
                <strong className="text-[#282824]">{getCostAllocationMethodLabel(expense.costAllocationMethod)}</strong>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-[#E3DCCD]/60 text-[11px]">
              <div>
                <span className="text-[#68675F] block text-[10px]">طريقة التوزيع الزمني:</span>
                <strong className="text-[#282824]">{getTemporalDistributionLabel(expense.temporalDistribution)}</strong>
              </div>
              <div>
                <span className="text-[#68675F] block text-[10px]">فترة التغطية المعتمدة:</span>
                <strong className="text-[#282824] font-mono">
                  <bdi dir="ltr">{formatDate(expense.servicePeriodStart || expense.date)}</bdi> إلى <bdi dir="ltr">{formatDate(expense.servicePeriodEnd || expense.date)}</bdi>
                </strong>
              </div>
              <div>
                <span className="text-[#68675F] block text-[10px]">التكلفة المقدرة شهرياً:</span>
                <div className="text-emerald-800 font-bold">
                  {expense.temporalDistribution === 'equal_monthly' && expense.servicePeriodStart && expense.servicePeriodEnd ? (
                    <div className="flex items-center gap-1">
                      <CurrencyAmount amount={Math.round(expense.amount / Math.max(1, (new Date(expense.servicePeriodEnd).getFullYear() - new Date(expense.servicePeriodStart).getFullYear()) * 12 + (new Date(expense.servicePeriodEnd).getMonth() - new Date(expense.servicePeriodStart).getMonth()) + 1))} />
                      <span className="text-xs font-normal">/شهر</span>
                    </div>
                  ) : (
                    <CurrencyAmount amount={expense.amount} />
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Unit Allocation Shares Table */}
          {expense.distributionShares && expense.distributionShares.length > 0 && (
            <div className="bg-white p-4 rounded-2xl border border-[#E3DCCD] space-y-2">
              <span className="text-xs font-bold text-[#282824] block">
                توزيع الحصص المالي المحمل على شقق المبنى ({expense.distributionShares.length} شقة)
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[10px]">
                {expense.distributionShares.map(s => (
                  <div key={s.unitId} className="bg-[#FAF8F5] p-2 rounded-xl border border-[#E3DCCD]">
                    <span className="font-bold text-[#282824] block">شقة #{s.unitNumber}</span>
                    <div className="text-emerald-900 font-mono font-bold block">
                      <CurrencyAmount amount={s.amount} />
                    </div>
                    {s.percentage && <span className="text-[#68675F] text-[9px]">({formatNumber(s.percentage)}%)</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Payment History & Cash Outflow Register */}
          <div className="bg-white p-4 rounded-2xl border border-[#E3DCCD] space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-[#282824] flex items-center gap-1.5">
                <CreditCard className="w-4 h-4 text-[#B69A68]" />
                <span>سجل الدفعات والسداد الفعلي المرتبط بالقيد ({expense.paymentsList?.length || 0})</span>
              </h4>
              {!isReversed && remainingToPay > 0 && (
                <button
                  onClick={() => setShowAddPayment(!showAddPayment)}
                  className="px-2.5 py-1 bg-[#282824] text-white rounded-lg text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3 h-3 text-[#B69A68]" />
                  <span>تسجيل دفعة سداد</span>
                </button>
              )}
            </div>

            {/* Add Payment Sub-form */}
            {showAddPayment && (
              <form onSubmit={handleAddPaymentSubmit} className="p-3.5 bg-[#FAF8F5] rounded-xl border border-[#B69A68] space-y-3">
                <span className="font-bold text-[#282824] block text-xs">سداد دفعة جديدة من المصروف</span>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                  <div>
                    <label className="block text-[10px] text-[#68675F] mb-1">المبلغ المسدد (ر.س) *</label>
                    <input
                      type="number"
                      max={remainingToPay}
                      min="1"
                      value={payAmount}
                      onChange={(e) => setPayAmount(Number(e.target.value))}
                      className="w-full bg-white border border-[#E3DCCD] rounded-lg px-2.5 py-1.5 text-xs font-mono font-bold"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-[#68675F] mb-1">تاريخ الدفع *</label>
                    <input
                      type="date"
                      value={payDate}
                      onChange={(e) => setPayDate(e.target.value)}
                      className="w-full bg-white border border-[#E3DCCD] rounded-lg px-2.5 py-1.5 text-xs font-mono"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-[#68675F] mb-1">وسيلة السداد</label>
                    <select
                      value={payMethod}
                      onChange={(e) => setPayMethod(e.target.value as any)}
                      className="w-full bg-white border border-[#E3DCCD] rounded-lg px-2.5 py-1.5 text-xs"
                    >
                      <option value="bank_transfer">حوالة بنكية</option>
                      <option value="company_card">بطاقة الشركة</option>
                      <option value="cash">نقداً</option>
                      <option value="check">شيك</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] text-[#68675F] mb-1">رقم الإيصال / الحوالة</label>
                    <input
                      type="text"
                      value={payRef}
                      onChange={(e) => setPayRef(e.target.value)}
                      placeholder="مرجع السند"
                      className="w-full bg-white border border-[#E3DCCD] rounded-lg px-2.5 py-1.5 text-xs font-mono"
                    />
                  </div>
                </div>
                <div className="flex items-center justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setShowAddPayment(false)}
                    className="px-3 py-1 bg-white border border-[#E3DCCD] rounded-lg text-[11px]"
                  >
                    إلغاء
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1 bg-[#282824] text-white rounded-lg text-[11px] font-bold"
                  >
                    حفظ الدفعة
                  </button>
                </div>
              </form>
            )}

            {/* Payments List Table */}
            {(expense.paymentsList && expense.paymentsList.length > 0) ? (
              <div className="overflow-x-auto">
                <table className="w-full text-right text-[11px]">
                  <thead className="bg-[#FAF8F5] text-[#282824] font-bold">
                    <tr>
                      <th className="p-2">تاريخ الدفع</th>
                      <th className="p-2">المبلغ المسدد</th>
                      <th className="p-2">وسيلة السداد</th>
                      <th className="p-2">رقم الإيصال / المرجع</th>
                      <th className="p-2">المسؤول</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E3DCCD]">
                    {expense.paymentsList.map(p => (
                      <tr key={p.id}>
                        <td className="p-2 font-mono text-[#68675F]">
                          <bdi dir="ltr">{formatDate(p.paymentDate)}</bdi>
                        </td>
                        <td className="p-2 font-bold text-emerald-800">
                          <CurrencyAmount amount={p.amount} />
                        </td>
                        <td className="p-2 text-[#282824]">
                          {p.paymentMethod === 'bank_transfer' ? 'حوالة بنكية' : p.paymentMethod === 'company_card' ? 'بطاقة الشركة' : 'نقداً'}
                        </td>
                        <td className="p-2 font-mono text-[#68675F]">{p.receiptReference || '-'}</td>
                        <td className="p-2 text-[#68675F]">{p.recordedBy}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-[11px] text-[#68675F] py-2">لا توجد دفعات نقدية مسجلة بعد لهذا القيد.</p>
            )}
          </div>

          {/* Modification Audit Trail */}
          {expense.modificationAudit && expense.modificationAudit.length > 0 && (
            <div className="bg-[#FAF8F5] p-4 rounded-2xl border border-[#E3DCCD] space-y-2">
              <span className="font-bold text-[#282824] flex items-center gap-1.5 text-xs">
                <History className="w-4 h-4 text-[#B69A68]" />
                <span>سجل التعديلات والمسار التدقيقي</span>
              </span>
              <div className="space-y-1.5 text-[11px]">
                {expense.modificationAudit.map((m, idx) => (
                  <div key={idx} className="bg-white p-2.5 rounded-xl border border-[#E3DCCD]">
                    <span className="text-[#68675F] text-[10px] block font-mono">
                      <bdi dir="ltr">{formatDate(m.modifiedAt, 'short')}</bdi> · بواسطة {m.modifiedBy}
                    </span>
                    <span className="text-[#282824] font-medium block mt-0.5">سبب التعديل: {m.reason}</span>
                    {m.previousAmount && (
                      <div className="text-amber-800 text-[10px] flex items-center gap-1 mt-0.5 font-mono">
                        <span>المبلغ السابق قبل التعديل:</span>
                        <CurrencyAmount amount={m.previousAmount} />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Reversal Sub-form */}
          {showReverseForm && (
            <form onSubmit={handleReverseSubmit} className="p-4 bg-rose-50 border border-rose-300 rounded-2xl space-y-3">
              <div className="flex items-center gap-2 text-rose-900 font-bold text-xs">
                <AlertTriangle className="w-4 h-4 text-rose-600" />
                <span>تأكيد عكس وإلغاء القيد المالي</span>
              </div>
              <p className="text-[11px] text-rose-800 leading-relaxed">
                عكس القيد لا يحذف السجل نهائياً بل يعلّمه كـ «معكوس» ويستثنيه فوراً من تقارير التكاليف وحسابات NOI للحفاظ على سلامة التدقيق المالي.
              </p>
              <div>
                <label className="block text-[11px] font-bold text-rose-900 mb-1">سبب ومبرر عكس المصروف (إلزامي للرقابة) *</label>
                <input
                  type="text"
                  value={reverseReason}
                  onChange={(e) => setReverseReason(e.target.value)}
                  placeholder="مثال: فاتورة مكررة / إلغاء طلب الشراء من المورد واسترداد المبلغ..."
                  className="w-full bg-white border border-rose-300 rounded-xl px-3 py-2 text-xs focus:outline-none"
                  required
                />
              </div>
              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowReverseForm(false)}
                  className="px-3.5 py-1.5 bg-white border border-rose-200 text-rose-800 rounded-xl text-xs font-semibold"
                >
                  إلغاء التراجع
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-rose-700 hover:bg-rose-800 text-white rounded-xl text-xs font-bold"
                >
                  تأكيد عكس القيد
                </button>
              </div>
            </form>
          )}

        </div>

        {/* Footer Actions */}
        <div className="p-4 sm:p-5 border-t border-[#E3DCCD] bg-[#FAF8F5] flex items-center justify-between">
          <div>
            {!isReversed && (
              <button
                type="button"
                onClick={() => setShowReverseForm(true)}
                className="px-3 py-1.5 text-rose-700 hover:bg-rose-100 rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>عكس وإلغاء القيد</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {!isReversed && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onEditExpense(expense);
                }}
                className="px-4 py-2 bg-white border border-[#E3DCCD] hover:bg-[#FAF8F5] text-[#282824] rounded-xl text-xs font-bold cursor-pointer"
              >
                تعديل بيانات القيد
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 bg-[#282824] hover:bg-[#1A1A17] text-white rounded-xl text-xs font-bold cursor-pointer"
            >
              إغلاق
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
