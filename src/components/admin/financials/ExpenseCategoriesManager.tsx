import React, { useState } from 'react';
import { useAppStore } from '../../../store/useAppStore';
import {
  ExpenseCategoryConfig,
  RecurringExpenseSchedule,
  CostCenterLevel,
  TemporalDistributionType,
  CostAllocationMethod
} from '../../../types';
import { CurrencyAmount, formatNumber } from '../../../utils/formatters';
import {
  Sliders,
  Plus,
  Edit,
  Archive,
  RotateCcw,
  CheckCircle2,
  Calendar,
  Layers,
  Sparkles,
  Building2,
  Trash2,
  Play,
  AlertCircle,
  X
} from 'lucide-react';
import {
  getCostCenterLevelLabel,
  getTemporalDistributionLabel,
  getCostAllocationMethodLabel,
  getExpenseCategoryLabel
} from '../../../utils/financialCalculations';

export const ExpenseCategoriesManager: React.FC = () => {
  const {
    state,
    updateExpenseCategory,
    addExpenseCategory,
    archiveExpenseCategory,
    addRecurringExpenseSchedule,
    updateRecurringExpenseSchedule,
    deleteRecurringExpenseSchedule,
    generateRecurringExpenseAccruals,
  } = useAppStore();

  const [activeTab, setActiveTab] = useState<'categories' | 'recurring'>('categories');

  // New Category Modal
  const [showAddCatModal, setShowAddCatModal] = useState(false);
  const [catNameAr, setCatNameAr] = useState('');
  const [catNameEn, setCatNameEn] = useState('');
  const [catCode, setCatCode] = useState('');
  const [catCostCenter, setCatCostCenter] = useState<CostCenterLevel>('property');
  const [catTemporal, setCatTemporal] = useState<TemporalDistributionType>('instant');
  const [catAllocation, setCatAllocation] = useState<CostAllocationMethod>('by_area');
  const [catIsCapitalFfe, setCatIsCapitalFfe] = useState(false);
  const [newSubcatInput, setNewSubcatInput] = useState('');

  // Add Subcategory inline state
  const [activeCatForSubcat, setActiveCatForSubcat] = useState<string | null>(null);
  const [inlineSubcatName, setInlineSubcatName] = useState('');

  // Recurring Schedule Generator state
  const [targetMonth, setTargetMonth] = useState('2026-09');
  const [generatedMsg, setGeneratedMsg] = useState<string | null>(null);

  // New Recurring Schedule Modal
  const [showAddRecurringModal, setShowAddRecurringModal] = useState(false);
  const [recName, setRecName] = useState('');
  const [recCategory, setRecCategory] = useState<any>('building_rent');
  const [recAmount, setRecAmount] = useState<number>(0);
  const [recFrequency, setRecFrequency] = useState<'monthly' | 'quarterly' | 'yearly'>('monthly');
  const [recLevel, setRecLevel] = useState<CostCenterLevel>('property');
  const [recPropertyId, setRecPropertyId] = useState(state.properties[0]?.id || '');
  const [recDescription, setRecDescription] = useState('');
  const [recVendor, setRecVendor] = useState('');
  const [recTemporal, setRecTemporal] = useState<TemporalDistributionType>('equal_monthly');
  const [recAllocation, setRecAllocation] = useState<CostAllocationMethod>('by_area');

  const categories = state.expenseCategories || [];
  const recurringSchedules = state.recurringExpenses || [];

  const handleCreateCategory = (e: React.FormEvent) => {
    e.preventDefault();
    if (!catNameAr.trim()) return;

    addExpenseCategory({
      code: (catCode.trim() || `cat_${Date.now()}`) as any,
      nameAr: catNameAr,
      nameEn: catNameEn || catNameAr,
      defaultCostCenterLevel: catCostCenter,
      defaultTemporalDistribution: catTemporal,
      defaultAllocationMethod: catAllocation,
      isCapitalFfe: catIsCapitalFfe,
      isArchived: false,
      subcategories: newSubcatInput.trim() ? [
        { id: `sub-${Date.now()}`, nameAr: newSubcatInput.trim(), nameEn: newSubcatInput.trim() }
      ] : [],
    });

    setShowAddCatModal(false);
    setCatNameAr('');
    setCatNameEn('');
    setCatCode('');
    setNewSubcatInput('');
  };

  const handleAddInlineSubcategory = (catId: string) => {
    if (!inlineSubcatName.trim()) return;
    const cat = categories.find(c => c.id === catId);
    if (!cat) return;

    const newSub = {
      id: `sub-${Date.now()}`,
      nameAr: inlineSubcatName.trim(),
      nameEn: inlineSubcatName.trim(),
    };

    updateExpenseCategory(catId, {
      subcategories: [...cat.subcategories, newSub],
    });

    setInlineSubcatName('');
    setActiveCatForSubcat(null);
  };

  const handleGenerateAccruals = () => {
    setGeneratedMsg(null);
    try {
      const created = generateRecurringExpenseAccruals(targetMonth, 'مشرف التكاليف والمالية');
      if (created && created.length > 0) {
        const totalSum = created.reduce((s, e) => s + e.amount, 0);
        setGeneratedMsg(`تم بنجاح توليد عدد (${formatNumber(created.length)}) قيد استحقاق دوري لشهر ${targetMonth} بإجمالي ${formatNumber(totalSum)} ر.س`);
      } else {
        setGeneratedMsg(`تم فحص الجداول: استحقاقات شهر ${targetMonth} مولدة بالفعل مسبقاً لمنع التكرار المحاسبي.`);
      }
    } catch (err: any) {
      setGeneratedMsg(`خطأ: ${err.message}`);
    }
  };

  const handleCreateRecurring = (e: React.FormEvent) => {
    e.preventDefault();
    if (recAmount <= 0 || !recName.trim()) return;

    addRecurringExpenseSchedule({
      name: recName,
      category: recCategory,
      description: recDescription || recName,
      amount: recAmount,
      isFfeOrEquipment: false,
      costCenterLevel: recLevel,
      propertyId: recLevel === 'company' ? undefined : recPropertyId,
      vendorOrBeneficiary: recVendor || 'مورد عام',
      frequency: recFrequency,
      startDate: `${new Date().getFullYear()}-01-01`,
      endDate: `${new Date().getFullYear()}-12-31`,
      temporalDistribution: recTemporal,
      costAllocationMethod: recAllocation,
      isActive: true,
    });

    setShowAddRecurringModal(false);
    setRecName('');
    setRecAmount(0);
    setRecDescription('');
    setRecVendor('');
  };

  return (
    <div className="space-y-6 text-right">
      
      {/* Top Banner */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="text-base font-bold text-[#282824] flex items-center gap-2">
            <Sliders className="w-5 h-5 text-[#B69A68]" />
            <span>إعدادات شجرة التصنيفات وقواعد التوزيع الافتراضية</span>
          </h3>
          <p className="text-xs text-[#68675F] mt-0.5">
            تحديد القواعد الافتراضية لكل تصنيف للمصروف وإدارة قوالب المصاريف المتكررة (كالإيجارات والرواتب)
          </p>
        </div>

        {/* Sub Tabs */}
        <div className="flex items-center gap-1.5 p-1 bg-white rounded-2xl border border-[#E3DCCD]">
          <button
            onClick={() => setActiveTab('categories')}
            className={`px-3.5 py-1.5 rounded-xl font-bold text-xs transition-all cursor-pointer ${
              activeTab === 'categories' ? 'bg-[#282824] text-white shadow-xs' : 'text-[#68675F] hover:text-[#282824]'
            }`}
          >
            شجرة التصنيفات وقواعدها ({categories.length})
          </button>
          <button
            onClick={() => setActiveTab('recurring')}
            className={`px-3.5 py-1.5 rounded-xl font-bold text-xs transition-all cursor-pointer ${
              activeTab === 'recurring' ? 'bg-[#282824] text-white shadow-xs' : 'text-[#68675F] hover:text-[#282824]'
            }`}
          >
            المصاريف المتكررة ومولد الاستحقاقات ({recurringSchedules.length})
          </button>
        </div>
      </div>

      {/* TAB 1: CATEGORIES TREE & DEFAULT ALLOCATION RULES */}
      {activeTab === 'categories' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#282824]">
              قائمة تصنيفات المصاريف المعتمدة وقواعد توزيعها
            </span>
            <button
              onClick={() => setShowAddCatModal(true)}
              className="px-3.5 py-2 bg-[#282824] hover:bg-[#1A1A17] text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              <Plus className="w-4 h-4 text-[#B69A68]" />
              <span>إضافة تصنيف جديد</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {categories.map(cat => (
              <div
                key={cat.id}
                className={`bg-white rounded-3xl border p-5 shadow-xs transition-all space-y-3 ${
                  cat.isArchived ? 'opacity-60 border-dashed border-gray-300' : 'border-[#E3DCCD]'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-sm text-[#282824]">{cat.nameAr}</h4>
                      {cat.isCapitalFfe && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-900 border border-purple-200">
                          رأسمالي FF&E
                        </span>
                      )}
                      {cat.isArchived && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-gray-100 text-gray-700">
                          مؤرشف
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] text-[#68675F] block font-sans">{cat.nameEn}</span>
                  </div>

                  <button
                    onClick={() => archiveExpenseCategory(cat.id)}
                    className="p-1.5 hover:bg-[#FAF8F5] rounded-lg text-[#68675F] transition-colors cursor-pointer"
                    title={cat.isArchived ? 'إلغاء الأرشفة' : 'أرشفة التصنيف'}
                  >
                    <Archive className="w-4 h-4" />
                  </button>
                </div>

                {/* Default Rules */}
                <div className="grid grid-cols-3 gap-2 bg-[#FAF8F5] p-3 rounded-2xl border border-[#E3DCCD] text-[11px]">
                  <div>
                    <span className="text-[#68675F] block text-[10px]">المركز الافتراضي:</span>
                    <strong className="text-[#282824]">{getCostCenterLevelLabel(cat.defaultCostCenterLevel)}</strong>
                  </div>
                  <div>
                    <span className="text-[#68675F] block text-[10px]">التوزيع الزمني:</span>
                    <strong className="text-[#282824]">{getTemporalDistributionLabel(cat.defaultTemporalDistribution)}</strong>
                  </div>
                  <div>
                    <span className="text-[#68675F] block text-[10px]">قاعدة الوحدات:</span>
                    <strong className="text-[#282824]">{getCostAllocationMethodLabel(cat.defaultAllocationMethod)}</strong>
                  </div>
                </div>

                {/* Subcategories list */}
                <div className="space-y-1.5 pt-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-[#68675F]">التصنيفات الفرعية المرتبطة:</span>
                    <button
                      onClick={() => setActiveCatForSubcat(activeCatForSubcat === cat.id ? null : cat.id)}
                      className="text-[10px] font-bold text-[#B69A68] hover:underline cursor-pointer flex items-center gap-0.5"
                    >
                      <Plus className="w-3 h-3" />
                      <span>إضافة فرعي</span>
                    </button>
                  </div>

                  {activeCatForSubcat === cat.id && (
                    <div className="flex items-center gap-1.5 pt-1">
                      <input
                        type="text"
                        value={inlineSubcatName}
                        onChange={(e) => setInlineSubcatName(e.target.value)}
                        placeholder="اسم التصنيف الفرعي الجديد..."
                        className="flex-1 bg-[#FAF8F5] border border-[#E3DCCD] rounded-xl px-2.5 py-1 text-xs focus:outline-none"
                      />
                      <button
                        onClick={() => handleAddInlineSubcategory(cat.id)}
                        className="px-2.5 py-1 bg-[#282824] text-white rounded-xl text-xs font-bold"
                      >
                        حفظ
                      </button>
                    </div>
                  )}

                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {cat.subcategories.map(sub => (
                      <span
                        key={sub.id}
                        className="px-2.5 py-1 bg-white border border-[#E3DCCD] rounded-xl text-[10px] font-semibold text-[#282824]"
                      >
                        {sub.nameAr}
                      </span>
                    ))}
                    {cat.subcategories.length === 0 && (
                      <span className="text-[10px] text-[#68675F] italic">لا توجد تصنيفات فرعية</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 2: RECURRING EXPENSES & ACCRUAL GENERATOR */}
      {activeTab === 'recurring' && (
        <div className="space-y-5">
          
          {/* Accruals Generator Banner */}
          <div className="bg-white p-5 rounded-3xl border border-[#E3DCCD] shadow-xs space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h4 className="font-bold text-sm text-[#282824] flex items-center gap-2">
                  <Play className="w-4 h-4 text-emerald-700" />
                  <span>مولّد استحقاقات التكاليف الدورية التلقائي</span>
                </h4>
                <p className="text-[11px] text-[#68675F] mt-0.5">
                  يولّد قيود استحقاق شهرية وفقاً لجداول الإيجار السنوي والرواتب وعقود الصيانة دون تكرار القيد لنفس الشهر
                </p>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="month"
                  value={targetMonth}
                  onChange={(e) => setTargetMonth(e.target.value)}
                  className="bg-[#FAF8F5] border border-[#E3DCCD] rounded-xl px-3 py-2 text-xs font-mono font-bold text-[#282824]"
                />
                <button
                  onClick={handleGenerateAccruals}
                  className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs cursor-pointer"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>توليد استحقاقات الشهر المختار</span>
                </button>
              </div>
            </div>

            {generatedMsg && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-900 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{generatedMsg}</span>
              </div>
            )}
          </div>

          {/* Schedules Table */}
          <div className="bg-white rounded-3xl border border-[#E3DCCD] overflow-hidden shadow-xs">
            <div className="p-4 bg-[#FAF8F5] border-b border-[#E3DCCD] flex items-center justify-between">
              <div>
                <h4 className="font-bold text-xs sm:text-sm text-[#282824]">
                  جداول وقوالب المصاريف المتكررة ({recurringSchedules.length} جدول دوري)
                </h4>
                <p className="text-[10px] text-[#68675F] mt-0.5">
                  قوالب ثابتة لإيجار المبنى، رواتب الحراس، اشتراك الإنترنت، والإدارة المركزية
                </p>
              </div>
              <button
                onClick={() => setShowAddRecurringModal(true)}
                className="px-3 py-1.5 bg-[#282824] hover:bg-[#1A1A17] text-white rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5 text-[#B69A68]" />
                <span>إضافة قالب متكرر جديد</span>
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs border-collapse">
                <thead className="bg-[#FAF8F5] text-[#282824] font-bold border-b border-[#E3DCCD]">
                  <tr>
                    <th className="p-3">اسم المصروف الدوري</th>
                    <th className="p-3">التصنيف</th>
                    <th className="p-3">دورية التكرار</th>
                    <th className="p-3">مركز التكلفة</th>
                    <th className="p-3">المبلغ التعاقدي</th>
                    <th className="p-3">القسط الشهري المحمل</th>
                    <th className="p-3">قاعدة توزيع الوحدات</th>
                    <th className="p-3">آخر شهر تم توليده</th>
                    <th className="p-3 text-left">الإجراء</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E3DCCD]">
                  {recurringSchedules.map(sch => {
                    const prop = state.properties.find(p => p.id === sch.propertyId);
                    const monthlyEquivalent = sch.frequency === 'yearly'
                      ? Math.round(sch.amount / 12)
                      : sch.frequency === 'quarterly'
                      ? Math.round(sch.amount / 3)
                      : sch.amount;

                    return (
                      <tr key={sch.id} className="hover:bg-[#FFFCF6] transition-colors">
                        <td className="p-3 font-bold text-[#282824]">
                          {sch.name}
                        </td>
                        <td className="p-3 text-[#68675F]">
                          {getExpenseCategoryLabel(sch.category)}
                        </td>
                        <td className="p-3">
                          <span className="px-2 py-0.5 bg-[#FAF8F5] border border-[#E3DCCD] rounded text-[10px] font-bold text-[#282824]">
                            {sch.frequency === 'yearly' ? 'سنوي' : sch.frequency === 'quarterly' ? 'ربع سنوي' : 'شهري'}
                          </span>
                        </td>
                        <td className="p-3 text-[#282824]">
                          {sch.costCenterLevel === 'company' ? 'الشركة العامة' : prop?.name || 'مبنى محدد'}
                        </td>
                        <td className="p-3 font-bold text-[#282824] whitespace-nowrap">
                          <CurrencyAmount amount={sch.amount} />
                        </td>
                        <td className="p-3 font-bold text-emerald-800 whitespace-nowrap">
                          <CurrencyAmount amount={monthlyEquivalent} className="text-emerald-800 font-bold" />/شهر
                        </td>
                        <td className="p-3 text-[#68675F] text-[11px]">
                          {getCostAllocationMethodLabel(sch.costAllocationMethod)}
                        </td>
                        <td className="p-3 font-mono text-[11px]">
                          {sch.lastGeneratedPeriod ? (
                            <span className="px-2 py-0.5 bg-emerald-100 text-emerald-900 rounded font-bold">
                              {sch.lastGeneratedPeriod}
                            </span>
                          ) : (
                            <span className="text-gray-400">لم يولّد بعد</span>
                          )}
                        </td>
                        <td className="p-3 text-left">
                          <button
                            onClick={() => deleteRecurringExpenseSchedule(sch.id)}
                            className="p-1 hover:bg-rose-100 text-rose-700 rounded transition-colors cursor-pointer"
                            title="حذف القالب الدوري"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 1: ADD CATEGORY MODAL */}
      {showAddCatModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-3xl border border-[#E3DCCD] shadow-2xl p-6 text-xs space-y-4">
            <div className="flex items-center justify-between border-b border-[#E3DCCD] pb-3">
              <h3 className="font-bold text-sm text-[#282824]">إضافة تصنيف مصروف وقاعدة توزيع جديدة</h3>
              <button onClick={() => setShowAddCatModal(false)}>
                <X className="w-4 h-4 text-[#68675F]" />
              </button>
            </div>

            <form onSubmit={handleCreateCategory} className="space-y-3.5">
              <div>
                <label className="block text-[11px] font-bold text-[#282824] mb-1">اسم التصنيف بالعربية *</label>
                <input
                  type="text"
                  value={catNameAr}
                  onChange={(e) => setCatNameAr(e.target.value)}
                  placeholder="مثال: رسوم تراخيص البرمجيات والأنظمة"
                  className="w-full bg-[#FAF8F5] border border-[#E3DCCD] rounded-xl px-3 py-2 text-xs"
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-[#282824] mb-1">الاسم بالإنجليزية</label>
                <input
                  type="text"
                  value={catNameEn}
                  onChange={(e) => setCatNameEn(e.target.value)}
                  placeholder="Software & Cloud Licenses"
                  className="w-full bg-[#FAF8F5] border border-[#E3DCCD] rounded-xl px-3 py-2 text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-[#282824] mb-1">مركز التكلفة الافتراضي</label>
                  <select
                    value={catCostCenter}
                    onChange={(e) => setCatCostCenter(e.target.value as any)}
                    className="w-full bg-[#FAF8F5] border border-[#E3DCCD] rounded-xl px-3 py-2 text-xs"
                  >
                    <option value="property">المبنى / المجمع</option>
                    <option value="unit">الوحدة السكنية</option>
                    <option value="company">الشركة العامة</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-[#282824] mb-1">طريقة التوزيع الافتراضية</label>
                  <select
                    value={catAllocation}
                    onChange={(e) => setCatAllocation(e.target.value as any)}
                    className="w-full bg-[#FAF8F5] border border-[#E3DCCD] rounded-xl px-3 py-2 text-xs"
                  >
                    <option value="by_area">بالمساحة م²</option>
                    <option value="equal_units">بالتساوي</option>
                    <option value="by_revenue">بنسبة الدخل</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-[#282824] mb-1">تصنيف فرعي أولي (اختياري)</label>
                <input
                  type="text"
                  value={newSubcatInput}
                  onChange={(e) => setNewSubcatInput(e.target.value)}
                  placeholder="مثال: اشتراك برنامج نقاط البيع السحابي"
                  className="w-full bg-[#FAF8F5] border border-[#E3DCCD] rounded-xl px-3 py-2 text-xs"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#E3DCCD]">
                <button
                  type="button"
                  onClick={() => setShowAddCatModal(false)}
                  className="px-4 py-2 bg-[#FAF8F5] rounded-xl font-medium"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#282824] text-white rounded-xl font-bold"
                >
                  حفظ التصنيف
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: ADD RECURRING SCHEDULE */}
      {showAddRecurringModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-3xl border border-[#E3DCCD] shadow-2xl p-6 text-xs space-y-4">
            <div className="flex items-center justify-between border-b border-[#E3DCCD] pb-3">
              <h3 className="font-bold text-sm text-[#282824]">إضافة قالب مصروف دوري متكرر</h3>
              <button onClick={() => setShowAddRecurringModal(false)}>
                <X className="w-4 h-4 text-[#68675F]" />
              </button>
            </div>

            <form onSubmit={handleCreateRecurring} className="space-y-3.5">
              <div>
                <label className="block text-[11px] font-bold text-[#282824] mb-1">اسم ومسمى المصروف الدوري *</label>
                <input
                  type="text"
                  value={recName}
                  onChange={(e) => setRecName(e.target.value)}
                  placeholder="مثال: إيجار عمارة العليا السنوي"
                  className="w-full bg-[#FAF8F5] border border-[#E3DCCD] rounded-xl px-3 py-2 text-xs"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-[#282824] mb-1">المبلغ الإجمالي للتعاقد (ر.س) *</label>
                  <input
                    type="number"
                    min="1"
                    value={recAmount || ''}
                    onChange={(e) => setRecAmount(Number(e.target.value))}
                    className="w-full bg-white border border-[#B69A68] rounded-xl px-3 py-2 text-xs font-mono font-bold"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-[#282824] mb-1">الدورية *</label>
                  <select
                    value={recFrequency}
                    onChange={(e) => setRecFrequency(e.target.value as any)}
                    className="w-full bg-[#FAF8F5] border border-[#E3DCCD] rounded-xl px-3 py-2 text-xs font-bold"
                  >
                    <option value="monthly">شهري</option>
                    <option value="quarterly">ربع سنوي</option>
                    <option value="yearly">سنوي كامل</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-[#282824] mb-1">التصنيف *</label>
                  <select
                    value={recCategory}
                    onChange={(e) => setRecCategory(e.target.value as any)}
                    className="w-full bg-[#FAF8F5] border border-[#E3DCCD] rounded-xl px-3 py-2 text-xs"
                  >
                    {categories.map(c => (
                      <option key={c.id} value={c.code}>{c.nameAr}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-[#282824] mb-1">المبنى / المجمع</label>
                  <select
                    value={recPropertyId}
                    onChange={(e) => setRecPropertyId(e.target.value)}
                    className="w-full bg-[#FAF8F5] border border-[#E3DCCD] rounded-xl px-3 py-2 text-xs"
                  >
                    {state.properties.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#E3DCCD]">
                <button
                  type="button"
                  onClick={() => setShowAddRecurringModal(false)}
                  className="px-4 py-2 bg-[#FAF8F5] rounded-xl font-medium"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#282824] text-white rounded-xl font-bold"
                >
                  حفظ القالب الدوري
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
