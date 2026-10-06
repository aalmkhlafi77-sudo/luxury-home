import React, { useState, useMemo } from 'react';
import { useAppStore } from '../../../store/useAppStore';
import { calculateAccrualProfitabilityReport, getExpenseCategoryLabel } from '../../../utils/financialCalculations';
import {
  Building2,
  Plus,
  TrendingUp,
  Layers,
  Calendar,
  Sparkles,
  PieChart,
  DollarSign,
  ShieldAlert,
  Sliders,
  CheckCircle2,
  Eye
} from 'lucide-react';
import { ExpenseRegistrationModal } from './ExpenseRegistrationModal';
import { ExpenseDetailsModal } from './ExpenseDetailsModal';
import { OperationalExpense } from '../../../types';
import { formatNumber, CurrencyAmount, formatDate } from '../../../utils/formatters';

export const NOIProfitabilityView: React.FC = () => {
  const { state } = useAppStore();

  const currentYear = new Date().getFullYear();
  const [periodPreset, setPeriodPreset] = useState<'this_month' | 'this_quarter' | 'full_year' | 'custom'>('full_year');
  const [periodStart, setPeriodStart] = useState<string>(`${currentYear}-01-01`);
  const [periodEnd, setPeriodEnd] = useState<string>(`${currentYear}-12-31`);
  const [selectedCityId, setSelectedCityId] = useState<string>('all');
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>('all');
  const [costAllocationMode, setCostAllocationMode] = useState<'direct_only' | 'fully_allocated'>('fully_allocated');
  
  // Modals
  const [showAddExpenseModal, setShowAddExpenseModal] = useState<boolean>(false);
  const [viewingExpense, setViewingExpense] = useState<OperationalExpense | null>(null);

  const filteredProperties = state.properties.filter(p => {
    if (selectedCityId !== 'all' && p.cityId !== selectedCityId && p.city !== selectedCityId) {
      return false;
    }
    return true;
  });

  const handlePresetChange = (preset: 'this_month' | 'this_quarter' | 'full_year' | 'custom') => {
    setPeriodPreset(preset);
    const today = new Date();
    const y = today.getFullYear();
    const m = (today.getMonth() + 1).toString().padStart(2, '0');

    if (preset === 'this_month') {
      const daysInM = new Date(y, today.getMonth() + 1, 0).getDate();
      setPeriodStart(`${y}-${m}-01`);
      setPeriodEnd(`${y}-${m}-${daysInM.toString().padStart(2, '0')}`);
    } else if (preset === 'this_quarter') {
      const qMonthStart = Math.floor(today.getMonth() / 3) * 3 + 1;
      const qMonthEnd = qMonthStart + 2;
      const daysInQEnd = new Date(y, qMonthEnd, 0).getDate();
      setPeriodStart(`${y}-${qMonthStart.toString().padStart(2, '0')}-01`);
      setPeriodEnd(`${y}-${qMonthEnd.toString().padStart(2, '0')}-${daysInQEnd.toString().padStart(2, '0')}`);
    } else if (preset === 'full_year') {
      setPeriodStart(`${y}-01-01`);
      setPeriodEnd(`${y}-12-31`);
    }
  };

  const report = useMemo(() => {
    return calculateAccrualProfitabilityReport(state, {
      periodStart,
      periodEnd,
      propertyId: selectedPropertyId,
      costAllocationMode,
    });
  }, [state, periodStart, periodEnd, selectedPropertyId, costAllocationMode]);

  return (
    <div className="space-y-6 text-right">
      
      {/* Top Banner & Control Filters */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="text-base font-bold text-[#282824] flex items-center gap-2 justify-start">
            <Building2 className="w-5 h-5 text-[#B69A68]" />
            <span>تقرير صافي دخل التشغيل وأرباح المجمعات (NOI) وفق أساس الاستحقاق</span>
          </h3>
          <p className="text-xs text-[#68675F] mt-0.5">
            تحليلات دخل الإيجار مقابل التكاليف التشغيلية الموزعة زمنياً وجغرافياً مع استثناء الأثاث الرأسمالي (FF&E)
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 select-none">
          {/* Period Presets */}
          <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-[#E3DCCD]">
            <button
              onClick={() => handlePresetChange('this_month')}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                periodPreset === 'this_month' ? 'bg-[#282824] text-white' : 'text-[#68675F] hover:text-[#282824]'
              }`}
            >
              الشهر الحالي
            </button>
            <button
              onClick={() => handlePresetChange('this_quarter')}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                periodPreset === 'this_quarter' ? 'bg-[#282824] text-white' : 'text-[#68675F] hover:text-[#282824]'
              }`}
            >
              الربع الحالي
            </button>
            <button
              onClick={() => handlePresetChange('full_year')}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                periodPreset === 'full_year' ? 'bg-[#282824] text-white' : 'text-[#68675F] hover:text-[#282824]'
              }`}
            >
              كامل عام {currentYear}
            </button>
          </div>

          {/* City Filter */}
          <select
            value={selectedCityId}
            onChange={(e) => {
              setSelectedCityId(e.target.value);
              setSelectedPropertyId('all');
            }}
            className="bg-white border border-[#E3DCCD] rounded-xl px-3 py-2 text-xs font-bold text-[#282824] cursor-pointer"
          >
            <option value="all">جميع المدن ({state.cities.length})</option>
            {state.cities.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>

          {/* Property Filter */}
          <select
            value={selectedPropertyId}
            onChange={(e) => setSelectedPropertyId(e.target.value)}
            className="bg-white border border-[#E3DCCD] rounded-xl px-3 py-2 text-xs font-bold text-[#282824] cursor-pointer"
          >
            <option value="all">جميع مجمعات منزل الفخامة ({filteredProperties.length})</option>
            {filteredProperties.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>

          {/* Add Expense Button */}
          <button
            onClick={() => setShowAddExpenseModal(true)}
            className="px-3.5 py-2 bg-[#282824] hover:bg-[#1A1A17] text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs cursor-pointer"
          >
            <Plus className="w-4 h-4 text-[#B69A68]" />
            <span>تسجيل وتوزيع مصروف</span>
          </button>
        </div>
      </div>

      {/* Cost Allocation Mode Switch Banner */}
      <div className="bg-[#FAF8F5] p-4 rounded-3xl border border-[#E3DCCD] flex flex-wrap items-center justify-between gap-3 select-none">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-[#282824] text-[#B69A68] flex items-center justify-center font-bold">
            <Sliders className="w-4 h-4" />
          </div>
          <div>
            <span className="font-bold text-xs text-[#282824] block">نمط احتساب التكلفة التشغيلية للوحدات:</span>
            <span className="text-[11px] text-[#68675F]">
              {costAllocationMode === 'fully_allocated'
                ? 'التكلفة الشاملة الموزعة: تشمل المصروف المباشر للشقة + حصتها من إيجار وصيانة المبنى + المصاريف الإدارية العامة.'
                : 'التكلفة المباشرة فقط: تقتصر على المصاريف المنفقة حصراً على الشقة المستقلة وتستثني المصاريف المشتركة.'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 bg-white p-1 rounded-xl border border-[#E3DCCD]">
          <button
            onClick={() => setCostAllocationMode('fully_allocated')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              costAllocationMode === 'fully_allocated'
                ? 'bg-emerald-800 text-white shadow-xs'
                : 'text-[#68675F] hover:text-[#282824]'
            }`}
          >
            التكلفة الشاملة الموزعة (موصى به)
          </button>
          <button
            onClick={() => setCostAllocationMode('direct_only')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              costAllocationMode === 'direct_only'
                ? 'bg-emerald-800 text-white shadow-xs'
                : 'text-[#68675F] hover:text-[#282824]'
            }`}
          >
            التكلفة المباشرة فقط
          </button>
        </div>
      </div>

      {/* Overview Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 select-none">
        <div className="p-4 bg-white rounded-3xl border border-[#E3DCCD] shadow-xs">
          <span className="block text-[11px] font-bold text-[#68675F] mb-1">إيرادات الفترة المكتسبة</span>
          <div className="text-xl font-black text-emerald-900">
            <CurrencyAmount amount={report.companyTotalRevenue} />
          </div>
          <span className="text-[10px] text-[#68675F] block mt-0.5 font-mono">
            <bdi dir="ltr">{formatDate(periodStart)}</bdi> إلى <bdi dir="ltr">{formatDate(periodEnd)}</bdi>
          </span>
        </div>

        <div className="p-4 bg-white rounded-3xl border border-[#E3DCCD] shadow-xs">
          <span className="block text-[11px] font-bold text-[#68675F] mb-1">تكاليف التشغيل المستحقة (OPEX)</span>
          <div className="text-xl font-black text-rose-800">
            <CurrencyAmount amount={report.companyTotalOpex} />
          </div>
          <span className="text-[10px] text-[#68675F] block mt-0.5">
            {costAllocationMode === 'fully_allocated' ? 'مباشرة + موزعة' : 'مباشرة فقط'}
          </span>
        </div>

        <div className="p-4 bg-stone-900 text-white rounded-3xl shadow-xs">
          <span className="block text-[11px] font-bold text-stone-300 mb-1">صافي ربح التشغيل (NOI)</span>
          <div className="text-2xl font-black text-[#E8D7B0]">
            <CurrencyAmount amount={report.companyTotalNOI} />
          </div>
          <span className="text-[10px] text-stone-400 block mt-0.5">مؤشر الربحية الفعلي للمنشأة</span>
        </div>

        <div className="p-4 bg-white rounded-3xl border border-[#E3DCCD] shadow-xs">
          <span className="block text-[11px] font-bold text-[#68675F] mb-1">هامش ربح التشغيل الكلي</span>
          <span className="text-xl font-black text-[#282824] tabular-nums">
            <bdi dir="ltr">{formatNumber(report.companyMarginPercent)}%</bdi>
          </span>
          <span className="text-[10px] text-[#68675F] block mt-0.5">كفاءة استغلال الأصول المؤجرة</span>
        </div>

        <div className="p-4 bg-purple-50 rounded-3xl border border-purple-200 shadow-xs">
          <span className="block text-[11px] font-bold text-purple-900 mb-1">أصول وأثاث رأسمالي (FF&E)</span>
          <div className="text-xl font-black text-purple-950">
            <CurrencyAmount amount={report.companyFfeCapital} />
          </div>
          <span className="text-[10px] text-purple-800 block mt-0.5">مستثناة من حساب NOI</span>
        </div>
      </div>

      {/* Buildings Breakdown */}
      <div className="space-y-6">
        {report.properties.map(prop => (
          <div key={prop.propertyId} className="bg-white rounded-3xl border border-[#E3DCCD] p-6 shadow-xs space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#E3DCCD] pb-4">
              <div>
                <div className="flex items-center gap-2 justify-start">
                  <h4 className="text-base font-bold text-[#282824]">{prop.propertyName}</h4>
                  <span className="px-2.5 py-0.5 bg-[#FAF8F5] text-[#282824] border border-[#E3DCCD] rounded-full text-xs font-semibold select-none">
                    يضم {prop.unitsCount} شقة · المساحة الكلية {prop.totalAreaSqm} م²
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-4 text-xs select-none">
                <div>
                  <span className="text-[#68675F] block text-[10px]">إيراد الفترة:</span>
                  <div className="font-bold text-emerald-800">
                    <CurrencyAmount amount={prop.periodRevenue} />
                  </div>
                </div>
                <div>
                  <span className="text-[#68675F] block text-[10px]">تكاليف التشغيل المحملة:</span>
                  <div className="font-bold text-rose-800">
                    <CurrencyAmount amount={prop.totalOperatingExpense} />
                  </div>
                </div>
                <div className="bg-[#FAF8F5] px-3 py-1.5 rounded-xl border border-[#E3DCCD]">
                  <span className="text-[#68675F] block text-[10px]">صافي ربح المجمع (NOI)</span>
                  <div className="font-black text-[#282824] flex items-center gap-1">
                    <CurrencyAmount amount={prop.noi} />
                    <span className="text-xs font-normal">({formatNumber(prop.operatingMarginPercent)}%)</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Units detailed table */}
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs border-collapse">
                <thead className="bg-[#FAF8F5] text-[#282824] font-bold">
                  <tr>
                    <th className="p-3">رقم الشقة</th>
                    <th className="p-3">المساحة (م²)</th>
                    <th className="p-3 text-emerald-800 font-bold">إيراد الفترة</th>
                    <th className="p-3 text-[#68675F]">تكلفة مباشرة</th>
                    {costAllocationMode === 'fully_allocated' && (
                      <>
                        <th className="p-3 text-[#68675F]">حصة المبنى</th>
                        <th className="p-3 text-[#68675F]">حصة الإدارة العامة</th>
                      </>
                    )}
                    <th className="p-3 font-bold text-rose-800">إجمالي OPEX</th>
                    <th className="p-3 text-purple-900 font-bold">أثاث FF&E</th>
                    <th className="p-3 font-black">صافي NOI للوحدة</th>
                    <th className="p-3 font-bold text-[#B69A68]">هامش ربح الشقة</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E3DCCD]">
                  {prop.unitsBreakdown.map(u => (
                    <tr key={u.unitId} className="hover:bg-[#FFFCF6] transition-colors">
                      <td className="p-3 font-bold text-[#282824]">
                        شقة #{u.unitNumber}
                      </td>
                      <td className="p-3 text-[#68675F] tabular-nums font-mono">
                        <bdi dir="ltr">{formatNumber(u.areaSqm)} م²</bdi>
                      </td>
                      <td className="p-3 font-bold text-emerald-700">
                        {u.periodRevenue > 0 ? <CurrencyAmount amount={u.periodRevenue} /> : '-'}
                      </td>
                      <td className="p-3 text-[#68675F]">
                        {u.directOperatingExpense > 0 ? <CurrencyAmount amount={u.directOperatingExpense} /> : '-'}
                      </td>
                      {costAllocationMode === 'fully_allocated' && (
                        <>
                          <td className="p-3 text-[#68675F]">
                            {u.allocatedBuildingExpense > 0 ? <CurrencyAmount amount={u.allocatedBuildingExpense} /> : '-'}
                          </td>
                          <td className="p-3 text-[#68675F]">
                            {u.allocatedCompanyExpense > 0 ? <CurrencyAmount amount={u.allocatedCompanyExpense} /> : '-'}
                          </td>
                        </>
                      )}
                      <td className="p-3 font-bold text-rose-700">
                        {u.effectiveOperatingExpense > 0 ? <CurrencyAmount amount={u.effectiveOperatingExpense} /> : '-'}
                      </td>
                      <td className="p-3 font-bold text-purple-900">
                        {u.ffeCapitalExpense > 0 ? <CurrencyAmount amount={u.ffeCapitalExpense} /> : '-'}
                      </td>
                      <td className="p-3 font-black text-[#282824]">
                        <CurrencyAmount amount={u.noi} />
                      </td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          u.operatingMarginPercent >= 50
                            ? 'bg-emerald-100 text-emerald-800'
                            : u.operatingMarginPercent > 0
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-rose-100 text-rose-800'
                        }`}>
                          <bdi dir="ltr">{formatNumber(u.operatingMarginPercent)}%</bdi>
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>

      {/* Category Breakdown Summary */}
      <div className="bg-white rounded-3xl border border-[#E3DCCD] p-6 shadow-xs space-y-4">
        <h4 className="text-sm font-bold text-[#282824] flex items-center gap-2">
          <PieChart className="w-4 h-4 text-[#B69A68]" />
          <span>توزيع المصاريف المستحقة حسب بنود التكلفة في الفترة المحددة</span>
        </h4>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {report.categorySummary.map(c => (
            <div
              key={c.category}
              className={`p-3.5 rounded-2xl border ${
                c.isCapitalFfe
                  ? 'bg-purple-50 border-purple-200 text-purple-950'
                  : 'bg-[#FAF8F5] border-[#E3DCCD] text-[#282824]'
              }`}
            >
              <span className="text-[10px] font-bold block opacity-75">{c.categoryLabel}</span>
              <div className="text-base font-black block mt-0.5">
                <CurrencyAmount amount={c.totalAccruedAmount} />
              </div>
              <span className="text-[9px] opacity-60 block mt-0.5">
                {c.count} قيد مستحق {c.isCapitalFfe ? '(رأسمالي FF&E)' : ''}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Expense Registration Modal */}
      {showAddExpenseModal && (
        <ExpenseRegistrationModal
          onClose={() => setShowAddExpenseModal(false)}
          onSuccess={() => setShowAddExpenseModal(false)}
        />
      )}

      {/* Expense Details Modal */}
      {viewingExpense && (
        <ExpenseDetailsModal
          expense={viewingExpense}
          onClose={() => setViewingExpense(null)}
          onEditExpense={() => {
            setViewingExpense(null);
            setShowAddExpenseModal(true);
          }}
        />
      )}

    </div>
  );
};
