import React, { useState, useMemo } from 'react';
import { useAppStore } from '../../../store/useAppStore';
import {
  X,
  Plus,
  Building2,
  Calendar,
  CreditCard,
  CheckCircle2,
  AlertCircle,
  Clock,
  Layers,
  Sparkles,
  FileText,
  DollarSign
} from 'lucide-react';
import {
  ExpenseCategory,
  CostCenterLevel,
  TemporalDistributionType,
  CostAllocationMethod,
  ExpenseRecordStatus,
  OperationalExpense
} from '../../../types';
import {
  getExpenseCategoryLabel,
  getCostCenterLevelLabel,
  getTemporalDistributionLabel,
  getCostAllocationMethodLabel
} from '../../../utils/financialCalculations';
import { GregorianDatePicker } from '../../common/GregorianDatePicker';
import { CurrencyAmount, formatNumber } from '../../../utils/formatters';

interface Props {
  onClose: () => void;
  initialExpense?: OperationalExpense;
  onSuccess?: () => void;
}

export const ExpenseRegistrationModal: React.FC<Props> = ({
  onClose,
  initialExpense,
  onSuccess
}) => {
  const { state, addOperationalExpense, updateOperationalExpense } = useAppStore();

  const isEditing = !!initialExpense;

  // Form Fields
  const [expenseNumber, setExpenseNumber] = useState<string>(
    initialExpense?.expenseNumber || `EXP-2026-${Date.now().toString().slice(-4)}`
  );
  const [date, setDate] = useState<string>(
    initialExpense?.date || new Date().toISOString().slice(0, 10)
  );
  const [servicePeriodStart, setServicePeriodStart] = useState<string>(
    initialExpense?.servicePeriodStart || new Date().toISOString().slice(0, 10)
  );
  const [servicePeriodEnd, setServicePeriodEnd] = useState<string>(
    initialExpense?.servicePeriodEnd || new Date().toISOString().slice(0, 10)
  );

  const [category, setCategory] = useState<ExpenseCategory>(
    initialExpense?.category || 'building_rent'
  );
  const [subcategoryId, setSubcategoryId] = useState<string>(
    initialExpense?.subcategoryId || ''
  );
  const [description, setDescription] = useState<string>(
    initialExpense?.description || ''
  );
  const [amount, setAmount] = useState<number>(initialExpense?.amount || 0);

  // Capital FF&E vs OPEX
  const [isFfeOrEquipment, setIsFfeOrEquipment] = useState<boolean>(
    initialExpense?.isFfeOrEquipment || false
  );

  // Cost Center
  const [level, setLevel] = useState<CostCenterLevel>(
    initialExpense?.level || 'property'
  );
  const [propertyId, setPropertyId] = useState<string>(
    initialExpense?.propertyId || state.properties[0]?.id || ''
  );
  const [unitId, setUnitId] = useState<string>(initialExpense?.unitId || '');

  // Vendor & Invoicing
  const [vendorOrBeneficiary, setVendorOrBeneficiary] = useState<string>(
    initialExpense?.vendorOrBeneficiary || ''
  );
  const [invoiceDocNumber, setInvoiceDocNumber] = useState<string>(
    initialExpense?.invoiceDocNumber || ''
  );
  const [invoiceDocUrl, setInvoiceDocUrl] = useState<string>(
    initialExpense?.invoiceDocUrl || ''
  );

  // Temporal Distribution
  const [temporalDistribution, setTemporalDistribution] = useState<TemporalDistributionType>(
    initialExpense?.temporalDistribution || 'equal_monthly'
  );

  // Cost Allocation Method
  const [costAllocationMethod, setCostAllocationMethod] = useState<CostAllocationMethod>(
    initialExpense?.costAllocationMethod || 'by_area'
  );

  // Unit inclusion/exclusion
  const [includedUnitIds, setIncludedUnitIds] = useState<string[]>(
    initialExpense?.includedUnitIds || []
  );

  // Payment Status & Actual Payment Register (Decoupled Cash Flow)
  const [paymentOption, setPaymentOption] = useState<'paid_full' | 'paid_partial' | 'unpaid'>(
    initialExpense
      ? (initialExpense.paymentStatus === 'paid' ? 'paid_full' : initialExpense.paymentStatus === 'partial' ? 'paid_partial' : 'unpaid')
      : 'paid_full'
  );
  const [paidAmount, setPaidAmount] = useState<number>(
    initialExpense?.paidAmount !== undefined ? initialExpense.paidAmount : initialExpense?.amount || 0
  );
  const [paymentDate, setPaymentDate] = useState<string>(
    initialExpense?.paymentsList?.[0]?.paymentDate || new Date().toISOString().slice(0, 10)
  );
  const [paymentMethod, setPaymentMethod] = useState<'bank_transfer' | 'company_card' | 'cash' | 'check'>(
    (initialExpense?.paymentMethod as any) || 'bank_transfer'
  );
  const [paymentReceiptRef, setPaymentReceiptRef] = useState<string>(
    initialExpense?.paymentsList?.[0]?.receiptReference || ''
  );

  // Record status & notes
  const [recordStatus, setRecordStatus] = useState<ExpenseRecordStatus>(
    initialExpense?.recordStatus || 'approved'
  );
  const [notes, setNotes] = useState<string>(initialExpense?.notes || '');
  const [editReason, setEditReason] = useState<string>('');

  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Find category config
  const categoryConfig = useMemo(() => {
    return state.expenseCategories?.find(c => c.code === category);
  }, [state.expenseCategories, category]);

  // Available subcategories
  const availableSubcategories = categoryConfig?.subcategories || [];

  // When category changes, auto-set default settings if not editing
  const handleCategoryChange = (newCat: ExpenseCategory) => {
    setCategory(newCat);
    const cfg = state.expenseCategories?.find(c => c.code === newCat);
    if (cfg && !isEditing) {
      setLevel(cfg.defaultCostCenterLevel);
      setTemporalDistribution(cfg.defaultTemporalDistribution);
      setCostAllocationMethod(cfg.defaultAllocationMethod);
      setIsFfeOrEquipment(cfg.isCapitalFfe);
      setSubcategoryId(cfg.subcategories[0]?.id || '');
    }
  };

  // Units eligible for allocation
  const eligibleUnits = useMemo(() => {
    if (level === 'company') {
      return state.units.filter(u => u.publicationStatus !== 'archived');
    }
    if (level === 'property' && propertyId) {
      return state.units.filter(u => u.propertyId === propertyId && u.publicationStatus !== 'archived');
    }
    return [];
  }, [state.units, level, propertyId]);

  // Live preview calculation: monthly accrued cost and unit shares
  const previewCalculation = useMemo(() => {
    if (amount <= 0) return null;

    let monthlyCost = amount;
    let totalMonths = 1;

    if (temporalDistribution === 'equal_monthly' && servicePeriodStart && servicePeriodEnd) {
      const d1 = new Date(servicePeriodStart);
      const d2 = new Date(servicePeriodEnd);
      totalMonths = Math.max(1, (d2.getFullYear() - d1.getFullYear()) * 12 + (d2.getMonth() - d1.getMonth()) + 1);
      monthlyCost = Math.round(amount / totalMonths);
    }

    // Units for distribution
    let candidateUnits = eligibleUnits;
    if (includedUnitIds.length > 0) {
      candidateUnits = candidateUnits.filter(u => includedUnitIds.includes(u.id));
    }

    let unitShares: { unitId: string; unitNumber: string; areaSqm: number; amount: number; percentage: number }[] = [];

    if (level === 'unit' && unitId) {
      const u = state.units.find(x => x.id === unitId);
      if (u) {
        unitShares.push({
          unitId: u.id,
          unitNumber: u.unitNumber,
          areaSqm: u.areaSqm,
          amount,
          percentage: 100
        });
      }
    } else if (candidateUnits.length > 0) {
      if (costAllocationMethod === 'by_area') {
        const totalArea = candidateUnits.reduce((sum, u) => sum + (u.areaSqm || 50), 0);
        unitShares = candidateUnits.map(u => {
          const ratio = (u.areaSqm || 50) / (totalArea || 1);
          return {
            unitId: u.id,
            unitNumber: u.unitNumber,
            areaSqm: u.areaSqm,
            amount: Math.round(amount * ratio),
            percentage: Math.round(ratio * 1000) / 10
          };
        });
      } else {
        const share = Math.round(amount / candidateUnits.length);
        const pct = Math.round((100 / candidateUnits.length) * 10) / 10;
        unitShares = candidateUnits.map(u => ({
          unitId: u.id,
          unitNumber: u.unitNumber,
          areaSqm: u.areaSqm,
          amount: share,
          percentage: pct
        }));
      }
    }

    return {
      monthlyCost,
      totalMonths,
      unitShares,
      candidateCount: candidateUnits.length
    };
  }, [amount, temporalDistribution, servicePeriodStart, servicePeriodEnd, level, propertyId, unitId, eligibleUnits, includedUnitIds, costAllocationMethod, state.units]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (amount <= 0) {
      setErrorMsg('قيمة المصروف يجب أن تكون أكبر من الصفر.');
      return;
    }
    if (!description.trim()) {
      setErrorMsg('وصف ومبرر الصرف التشغيلي ضروري لحفظ القيد.');
      return;
    }
    if (level === 'unit' && !unitId) {
      setErrorMsg('الرجاء اختيار الشقة الفندقية المستهدفة بالمصروف المباشر.');
      return;
    }
    if (level === 'property' && !propertyId) {
      setErrorMsg('الرجاء اختيار المجمع أو المبنى المعني.');
      return;
    }

    // Determine actual paid amount
    const actualPaid = paymentOption === 'paid_full'
      ? amount
      : paymentOption === 'paid_partial'
      ? Math.min(amount, paidAmount)
      : 0;

    const actualPaymentStatus: 'paid' | 'partial' | 'unpaid' =
      actualPaid >= amount ? 'paid' : actualPaid > 0 ? 'partial' : 'unpaid';

    const paymentsList = actualPaid > 0 ? [
      {
        id: `pay-${expenseNumber}-${Date.now()}`,
        paymentDate,
        amount: actualPaid,
        paymentMethod,
        receiptReference: paymentReceiptRef || invoiceDocNumber,
        recordedBy: 'مشرف المالية والتشغيل',
        createdAt: new Date().toISOString(),
      }
    ] : [];

    const selectedSubcategory = availableSubcategories.find(s => s.id === subcategoryId);

    const payloadData: Omit<OperationalExpense, 'id' | 'createdAt'> = {
      expenseNumber,
      date,
      servicePeriodStart,
      servicePeriodEnd,
      category,
      subcategoryId: subcategoryId || undefined,
      subcategoryName: selectedSubcategory?.nameAr || undefined,
      description,
      amount,
      paidAmount: actualPaid,
      isFfeOrEquipment,
      level,
      propertyId: level === 'company' ? undefined : propertyId,
      unitId: level === 'unit' ? unitId : undefined,
      vendorOrBeneficiary: vendorOrBeneficiary || 'مورد عام',
      invoiceDocNumber,
      invoiceDocUrl,
      paymentStatus: actualPaymentStatus,
      paymentMethod,
      distributionType: costAllocationMethod === 'by_area' ? 'by_area' : costAllocationMethod === 'equal_units' ? 'equal' : 'none',
      temporalDistribution,
      costAllocationMethod: level === 'unit' ? 'direct_unit' : costAllocationMethod,
      includedUnitIds: includedUnitIds.length > 0 ? includedUnitIds : undefined,
      recordStatus,
      paymentsList,
      notes,
      createdBy: initialExpense?.createdBy || 'مشرف المالية والتشغيل',
    };

    try {
      if (isEditing && initialExpense) {
        updateOperationalExpense(
          initialExpense.id,
          payloadData,
          'مشرف المالية والتشغيل',
          editReason || 'تحديث تفاصيل المصروف والتوزيع المالي'
        );
      } else {
        addOperationalExpense(payloadData);
      }
      if (onSuccess) onSuccess();
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'حدث خطأ أثناء حفظ قيد المصروف.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 text-right">
      <div className="bg-white w-full max-w-3xl rounded-3xl border border-[#E3DCCD] shadow-2xl overflow-hidden text-xs flex flex-col max-h-[92vh]">
        
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-[#E3DCCD] flex items-center justify-between bg-[#FAF8F5]">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#282824] text-[#B69A68] flex items-center justify-center font-bold">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-[#282824]">
                {isEditing ? 'تعديل قيد المصروف التشغيلي والتوزيع' : 'تسجيل قيد مصروف تشغيلي وتوزيع التكلفة'}
              </h3>
              <p className="text-[11px] text-[#68675F] mt-0.5">
                توزيع زمني وتكاليفي دقيق يفصل بين تاريخ السداد الفعلي وفترة الاستحقاق والوحدات المستفيدة
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

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-5 overflow-y-auto">
          
          {errorMsg && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 flex items-center gap-2 text-right">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* SECTION 1: الأساسيات والتصنيف */}
          <div className="bg-[#FAF8F5] p-4 rounded-2xl border border-[#E3DCCD] space-y-3.5">
            <h4 className="font-bold text-[#282824] flex items-center gap-1.5">
              <FileText className="w-4 h-4 text-[#B69A68]" />
              <span>بيانات القيد والتصنيف المستندي</span>
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-[#282824] mb-1">الرقم المرجعي للقيد *</label>
                <input
                  type="text"
                  value={expenseNumber}
                  onChange={(e) => setExpenseNumber(e.target.value)}
                  className="w-full bg-white border border-[#E3DCCD] rounded-xl px-3 py-2 text-xs font-mono font-bold select-all focus:outline-none focus:border-[#B69A68]"
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-[#282824] mb-1">تاريخ تسجيل القيد *</label>
                <GregorianDatePicker
                  value={date}
                  onChange={(val) => setDate(val)}
                  placeholder="اختر تاريخ القيد"
                  className="w-full"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-[#282824] mb-1">إجمالي مبلغ المصروف (ر.س) *</label>
                <input
                  type="number"
                  min="1"
                  step="any"
                  value={amount || ''}
                  onChange={(e) => setAmount(Number(e.target.value))}
                  placeholder="مثال: 120000"
                  className="w-full bg-white border border-[#B69A68] rounded-xl px-3 py-2 text-sm font-black text-[#282824] text-left focus:outline-none"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-[#282824] mb-1">تصنيف المصروف *</label>
                <select
                  value={category}
                  onChange={(e) => handleCategoryChange(e.target.value as any)}
                  className="w-full bg-white border border-[#E3DCCD] rounded-xl px-3 py-2 text-xs font-bold text-[#282824] cursor-pointer focus:outline-none"
                >
                  {(state.expenseCategories || []).map(cat => (
                    <option key={cat.id} value={cat.code}>
                      {cat.nameAr} {cat.isCapitalFfe ? '(رأسمالي FF&E)' : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-[#282824] mb-1">التصنيف الفرعي</label>
                <select
                  value={subcategoryId}
                  onChange={(e) => setSubcategoryId(e.target.value)}
                  className="w-full bg-white border border-[#E3DCCD] rounded-xl px-3 py-2 text-xs text-[#282824] cursor-pointer focus:outline-none"
                >
                  <option value="">-- بدون تصنيف فرعي --</option>
                  {availableSubcategories.map(sub => (
                    <option key={sub.id} value={sub.id}>{sub.nameAr}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-[#282824] mb-1">وصف ومبرر الصرف المستندي *</label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="مثال: إيجار عمارة برج النخيل بالكامل لعام ٢٠٢٦ ومسدد مقدماً..."
                className="w-full bg-white border border-[#E3DCCD] rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-[#B69A68]"
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-[#282824] mb-1">المستفيد أو المورد</label>
                <input
                  type="text"
                  value={vendorOrBeneficiary}
                  onChange={(e) => setVendorOrBeneficiary(e.target.value)}
                  placeholder="مثال: مؤسسة المالك العقارية / شركة الكهرباء"
                  className="w-full bg-white border border-[#E3DCCD] rounded-xl px-3 py-2 text-xs focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-[#282824] mb-1">رقم الفاتورة أو العقد المستندي</label>
                <input
                  type="text"
                  value={invoiceDocNumber}
                  onChange={(e) => setInvoiceDocNumber(e.target.value)}
                  placeholder="مثال: INV-2026-9921"
                  className="w-full bg-white border border-[#E3DCCD] rounded-xl px-3 py-2 text-xs font-mono focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* SECTION 2: مركز التكلفة والجهة الأصلية */}
          <div className="bg-[#FAF8F5] p-4 rounded-2xl border border-[#E3DCCD] space-y-3.5">
            <h4 className="font-bold text-[#282824] flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-[#B69A68]" />
              <span>مركز التكلفة والجهة الأصلية للمصروف</span>
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-[#282824] mb-1">المستوى والجهة الأصلية *</label>
                <select
                  value={level}
                  onChange={(e) => setLevel(e.target.value as any)}
                  className="w-full bg-white border border-[#E3DCCD] rounded-xl px-3 py-2 text-xs font-bold text-[#282824] cursor-pointer"
                >
                  <option value="property">المبنى / المجمع (مشترك بين وحداته)</option>
                  <option value="unit">الوحدة السكنية (مباشر على الشقة)</option>
                  <option value="company">الشركة العامة (عام للإدارة)</option>
                </select>
              </div>

              {level !== 'company' && (
                <div>
                  <label className="block text-[11px] font-bold text-[#282824] mb-1">المبنى / المجمع المعني *</label>
                  <select
                    value={propertyId}
                    onChange={(e) => setPropertyId(e.target.value)}
                    className="w-full bg-white border border-[#E3DCCD] rounded-xl px-3 py-2 text-xs font-semibold cursor-pointer"
                    required
                  >
                    {state.properties.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {level === 'unit' && (
                <div>
                  <label className="block text-[11px] font-bold text-[#282824] mb-1">الشقة المستهدفة بالصرف المباشر *</label>
                  <select
                    value={unitId}
                    onChange={(e) => setUnitId(e.target.value)}
                    className="w-full bg-white border border-[#E3DCCD] rounded-xl px-3 py-2 text-xs font-bold text-[#282824] cursor-pointer"
                    required
                  >
                    <option value="">-- اختر الشقة --</option>
                    {state.units.filter(u => u.propertyId === propertyId && u.publicationStatus !== 'archived').map(u => (
                      <option key={u.id} value={u.id}>شقة #{u.unitNumber} ({u.title})</option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Capital FF&E Banner */}
            <div className="p-3 bg-purple-50 border border-purple-200 rounded-xl flex items-center gap-2 select-none">
              <input
                type="checkbox"
                id="ffeModalCheck"
                checked={isFfeOrEquipment}
                onChange={(e) => setIsFfeOrEquipment(e.target.checked)}
                className="w-4 h-4 rounded text-purple-700 cursor-pointer"
              />
              <label htmlFor="ffeModalCheck" className="text-xs font-bold text-purple-950 cursor-pointer">
                شراء أثاث أو أجهزة رأسمالي (Capital FF&E)
                <span className="block text-[10px] text-purple-800 font-normal">
                  يُستثنى هذا المصروف من احتساب صافي دخل التشغيل (NOI) وفقاً للمعايير المحاسبية المعتمدة ويُدرج في تقرير الأصول الرأسمالية.
                </span>
              </label>
            </div>
          </div>

          {/* SECTION 3: التوزيع الزمني وفترة التغطية (Accrual Decoupling) */}
          <div className="bg-[#FAF8F5] p-4 rounded-2xl border border-[#E3DCCD] space-y-3.5">
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-[#282824] flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-[#B69A68]" />
                <span>فترة التكلفة والتوزيع الزمني (أساس الاستحقاق)</span>
              </h4>
              <span className="text-[10px] text-[#B69A68] bg-[#282824] px-2 py-0.5 rounded-full font-bold">
                يفصل التكلفة عن موعد السداد
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-[#282824] mb-1">طريقة التوزيع الزمني *</label>
                <select
                  value={temporalDistribution}
                  onChange={(e) => setTemporalDistribution(e.target.value as any)}
                  className="w-full bg-white border border-[#E3DCCD] rounded-xl px-3 py-2 text-xs font-bold text-[#282824] cursor-pointer"
                >
                  <option value="equal_monthly">توزيع بالتساوي على الأشهر المشمولة</option>
                  <option value="actual_days">توزيع بحسب الأيام الفعلية للتغطية</option>
                  <option value="instant">تحميل كامل فوري على تاريخ القيد</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-[#282824] mb-1">بداية فترة التغطية</label>
                <GregorianDatePicker
                  value={servicePeriodStart}
                  onChange={(val) => setServicePeriodStart(val)}
                  placeholder="اختر بداية الفترة"
                  className="w-full"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-[#282824] mb-1">نهاية فترة التغطية</label>
                <GregorianDatePicker
                  value={servicePeriodEnd}
                  onChange={(val) => setServicePeriodEnd(val)}
                  placeholder="اختر نهاية الفترة"
                  className="w-full"
                />
              </div>
            </div>
          </div>

          {/* SECTION 4: طريقة التوزيع على الوحدات والمباني */}
          {level !== 'unit' && (
            <div className="bg-[#FAF8F5] p-4 rounded-2xl border border-[#E3DCCD] space-y-3.5">
              <h4 className="font-bold text-[#282824] flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-[#B69A68]" />
                <span>طريقة توزيع التكلفة على الوحدات المستفيدة</span>
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-[#282824] mb-1">قاعدة التوزيع المعتمدة *</label>
                  <select
                    value={costAllocationMethod}
                    onChange={(e) => setCostAllocationMethod(e.target.value as any)}
                    className="w-full bg-white border border-[#E3DCCD] rounded-xl px-3 py-2 text-xs font-bold text-[#282824] cursor-pointer"
                  >
                    <option value="by_area">بنسبة مساحة الوحدات (م²) - عادل وموصى به للإيجار والصيانة</option>
                    <option value="equal_units">بالتساوي على كافة الوحدات المستفيدة</option>
                    <option value="by_revenue">بنسبة الدخل الفعلي للوحدات في تلك الفترة</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-[#282824] mb-1">تصفية الوحدات المستفيدة</label>
                  <div className="text-[11px] text-[#68675F] p-2 bg-white rounded-xl border border-[#E3DCCD]">
                    يتم التوزيع تلقائياً على كافة شقق المبنى ({eligibleUnits.length} شقة).
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* SECTION 5: الفصل المالي وسجل السداد الفعلي (Cash Outflow) */}
          <div className="bg-[#FAF8F5] p-4 rounded-2xl border border-[#E3DCCD] space-y-3.5">
            <h4 className="font-bold text-[#282824] flex items-center gap-1.5">
              <CreditCard className="w-4 h-4 text-[#B69A68]" />
              <span>سداد المدفوعات والتدفق النقدي الفعلي (Cash Outflow)</span>
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-[#282824] mb-1">حالة سداد الفاتورة *</label>
                <select
                  value={paymentOption}
                  onChange={(e) => setPaymentOption(e.target.value as any)}
                  className="w-full bg-white border border-[#E3DCCD] rounded-xl px-3 py-2 text-xs font-bold text-[#282824] cursor-pointer"
                >
                  <option value="paid_full">سُددت بالكامل (حوالة أو بطاقة)</option>
                  <option value="paid_partial">سُدد جزء منها فقط</option>
                  <option value="unpaid">مستحقة غير مسددة بعد (آجلة)</option>
                </select>
              </div>

              {paymentOption !== 'unpaid' && (
                <>
                  <div>
                    <label className="block text-[11px] font-bold text-[#282824] mb-1">المبلغ المسدد فعلياً (ر.س) *</label>
                    <input
                      type="number"
                      value={paymentOption === 'paid_full' ? amount : paidAmount}
                      onChange={(e) => setPaidAmount(Number(e.target.value))}
                      disabled={paymentOption === 'paid_full'}
                      className="w-full bg-white border border-[#E3DCCD] rounded-xl px-3 py-2 text-xs font-mono font-bold text-[#282824] disabled:bg-gray-100"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-[#282824] mb-1">تاريخ خروج المال الفعلي *</label>
                    <GregorianDatePicker
                      value={paymentDate}
                      onChange={(val) => setPaymentDate(val)}
                      placeholder="اختر تاريخ الدفع الفعلي"
                      className="w-full"
                    />
                  </div>
                </>
              )}
            </div>

            {paymentOption !== 'unpaid' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-[#282824] mb-1">وسيلة الدفع المعتمدة</label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value as any)}
                    className="w-full bg-white border border-[#E3DCCD] rounded-xl px-3 py-2 text-xs cursor-pointer"
                  >
                    <option value="bank_transfer">حوالة بنكية من حساب الشركة</option>
                    <option value="company_card">بطاقة المشتريات المؤسسية</option>
                    <option value="cash">صندوق العهد والنثريات النقدية</option>
                    <option value="check">شيك مصرفي معتمد</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-[#282824] mb-1">رقم سند الصرف أو مرجع الحوالة</label>
                  <input
                    type="text"
                    value={paymentReceiptRef}
                    onChange={(e) => setPaymentReceiptRef(e.target.value)}
                    placeholder="مثال: BANK-TRF-00192"
                    className="w-full bg-white border border-[#E3DCCD] rounded-xl px-3 py-2 text-xs font-mono focus:outline-none"
                  />
                </div>
              </div>
            )}
          </div>

          {/* LIVE PREVIEW BOX */}
          {previewCalculation && (
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl space-y-2 select-none">
              <div className="flex items-center justify-between">
                <span className="font-bold text-emerald-950 flex items-center gap-1.5 text-xs">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>معاينة حية لنتائج التوزيع التلقائي:</span>
                </span>
                <div className="text-[11px] font-bold text-emerald-800 flex items-center gap-1">
                  {temporalDistribution === 'equal_monthly' ? (
                    <>
                      <span>المحمل شهرياً:</span>
                      <CurrencyAmount amount={previewCalculation.monthlyCost} className="font-bold text-emerald-800" />
                      <span>/شهر (على مدى {formatNumber(previewCalculation.totalMonths)} شهر)</span>
                    </>
                  ) : (
                    <>
                      <span>المحمل على الفترة:</span>
                      <CurrencyAmount amount={amount} className="font-bold text-emerald-800" />
                    </>
                  )}
                </div>
              </div>
              <p className="text-[10px] text-emerald-800 leading-relaxed">
                سيتم تحميل هذا المصروف على تقارير NOI على أساس التكلفة الشهرية بدلاً من تحميل كامل القيمة في شهر السداد، وسيتم تخصيص نصيب كل شقة بحسب {getCostAllocationMethodLabel(costAllocationMethod)}.
              </p>
              {previewCalculation.unitShares.length > 0 && (
                <div className="mt-2 pt-2 border-t border-emerald-200/60 max-h-32 overflow-y-auto">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[10px]">
                    {previewCalculation.unitShares.slice(0, 8).map(s => (
                      <div key={s.unitId} className="bg-white p-2 rounded-lg border border-emerald-200">
                        <span className="font-bold text-[#282824] block">شقة #{formatNumber(s.unitNumber)}</span>
                        <div className="text-emerald-900 font-mono font-bold block">
                          <CurrencyAmount amount={s.amount} className="font-bold text-emerald-900" />
                        </div>
                        <span className="text-[#68675F] text-[9px] block">({formatNumber(s.percentage)}%)</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* EDIT REASON IF EDITING */}
          {isEditing && (
            <div>
              <label className="block text-[11px] font-bold text-[#282824] mb-1">سبب ومبرر التعديل (إلزامي للتدقيق والرقابة) *</label>
              <input
                type="text"
                value={editReason}
                onChange={(e) => setEditReason(e.target.value)}
                placeholder="مثال: تصحيح فترة التغطية لتكون سنة كاملة بدلاً من ٦ أشهر..."
                className="w-full bg-[#FAF8F5] border border-amber-300 rounded-xl px-3 py-2 text-xs focus:outline-none"
                required
              />
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#E3DCCD]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-[#F7F3EB] hover:bg-[#EFE9DF] text-[#282824] rounded-xl font-medium cursor-pointer"
            >
              تراجع وإلغاء
            </button>
            <button
              type="submit"
              className="px-6 py-2.5 bg-[#282824] hover:bg-[#1A1A17] text-white rounded-xl font-bold flex items-center gap-1.5 shadow-xs cursor-pointer text-xs"
            >
              <CheckCircle2 className="w-4 h-4 text-[#B69A68]" />
              <span>{isEditing ? 'حفظ التعديلات والترحيل' : 'اعتماد وتسجيل المصروف والتوزيع'}</span>
            </button>
          </div>

        </form>

      </div>
    </div>
  );
};
