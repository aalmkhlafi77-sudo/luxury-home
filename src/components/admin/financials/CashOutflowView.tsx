import React, { useState, useMemo } from 'react';
import { useAppStore } from '../../../store/useAppStore';
import {
  CreditCard,
  Calendar,
  Building2,
  DollarSign,
  Download,
  Filter,
  CheckCircle2,
  ArrowUpRight,
  TrendingDown
} from 'lucide-react';
import { calculateCashOutflowReport } from '../../../utils/financialCalculations';
import { CurrencyAmount, formatNumber, formatDate } from '../../../utils/formatters';

export const CashOutflowView: React.FC = () => {
  const { state } = useAppStore();

  const currentYear = new Date().getFullYear();
  const [periodPreset, setPeriodPreset] = useState<'this_month' | 'this_quarter' | 'full_year' | 'custom'>('full_year');
  const [periodStart, setPeriodStart] = useState<string>(`${currentYear}-01-01`);
  const [periodEnd, setPeriodEnd] = useState<string>(`${currentYear}-12-31`);
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>('all');

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
    return calculateCashOutflowReport(state, periodStart, periodEnd, selectedPropertyId);
  }, [state, periodStart, periodEnd, selectedPropertyId]);

  return (
    <div className="space-y-6 text-right">
      
      {/* Header and Controls */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="text-base font-bold text-[#282824] flex items-center gap-2">
            <TrendingDown className="w-5 h-5 text-rose-700" />
            <span>تقرير المدفوعات والتدفقات النقدية الفعلية (Cash Outflow)</span>
          </h3>
          <p className="text-xs text-[#68675F] mt-0.5">
            يرصد متى خرج المال فعلياً من الحسابات البنكية والصناديق (مفصول تماماً عن فترة التكلفة والاستحقاق)
          </p>
        </div>

        {/* Date presets and property filter */}
        <div className="flex flex-wrap items-center gap-2 select-none">
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
              كامل عام {formatNumber(currentYear)}
            </button>
          </div>

          <select
            value={selectedPropertyId}
            onChange={(e) => setSelectedPropertyId(e.target.value)}
            className="bg-white border border-[#E3DCCD] rounded-xl px-3 py-2 text-xs font-semibold text-[#282824] cursor-pointer"
          >
            <option value="all">كافة المجمعات</option>
            {state.properties.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Concept Explanation Banner */}
      <div className="p-4 bg-[#FAF8F5] border border-[#E3DCCD] rounded-3xl flex items-start gap-3 select-none">
        <div className="w-8 h-8 rounded-xl bg-[#282824] text-[#B69A68] flex items-center justify-center shrink-0 font-bold">
          !
        </div>
        <div className="space-y-1">
          <span className="font-bold text-xs text-[#282824] block">
            مبدأ الفصل الرقابي: السداد الفعلي مقابل التكلفة والاستحقاق
          </span>
          <p className="text-[11px] text-[#68675F] leading-relaxed">
            مثال توضيحي: إيجار عمارة النخيل السنوي بقيمة <strong><CurrencyAmount amount={120000} /></strong> يغطي سنة وسُدد مقدماً: يظهر كاملاً في هذا التقرير بتاريخ سداده الفعلي في شهر يناير، بينما يظهر في تقرير أرباح التشغيل (NOI) محملاً على السنة بالتساوي بنصيب <strong><CurrencyAmount amount={10000} /> شهرياً</strong> وموزعاً على الوحدات حسب المساحة.
          </p>
        </div>
      </div>

      {/* KPI Stats Scoreboard */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 select-none">
        <div className="p-4 bg-white rounded-3xl border border-[#E3DCCD] shadow-xs">
          <span className="block text-[11px] font-bold text-[#68675F] mb-1">إجمالي النقدية الخارجة</span>
          <div className="text-2xl font-black text-rose-800">
            <CurrencyAmount amount={report.totalOutflow} className="text-2xl font-black text-rose-800" />
          </div>
          <span className="text-[10px] text-[#68675F] block mt-0.5 font-mono" dir="ltr">
            {formatNumber(report.entries.length)} دفعة مالية مسددة
          </span>
        </div>

        <div className="p-4 bg-white rounded-3xl border border-[#E3DCCD] shadow-xs">
          <span className="block text-[11px] font-bold text-[#68675F] mb-1">مدفوعات تشغيلية (OPEX)</span>
          <div className="text-xl font-black text-[#282824]">
            <CurrencyAmount amount={report.operatingOutflow} className="text-xl font-black text-[#282824]" />
          </div>
          <span className="text-[10px] text-[#68675F] block mt-0.5">إيجارات، فواتير، صيانة</span>
        </div>

        <div className="p-4 bg-purple-50 rounded-3xl border border-purple-200 shadow-xs">
          <span className="block text-[11px] font-bold text-purple-900 mb-1">مدفوعات أثاث وأجهزة (FF&E)</span>
          <div className="text-xl font-black text-purple-950">
            <CurrencyAmount amount={report.capitalFfeOutflow} className="text-xl font-black text-purple-950" />
          </div>
          <span className="text-[10px] text-purple-800 block mt-0.5">مشتريات رأسمالية للأصول</span>
        </div>

        <div className="p-4 bg-[#FAF8F5] rounded-3xl border border-[#E3DCCD] shadow-xs">
          <span className="block text-[11px] font-bold text-[#68675F] mb-1">فترة الرصد والتقرير</span>
          <span className="text-xs font-mono font-bold text-[#282824] block mt-1" dir="ltr">
            {formatDate(periodStart)} إلى {formatDate(periodEnd)}
          </span>
          <span className="text-[10px] text-[#68675F] block mt-0.5">بحسب تواريخ خروج النقدية</span>
        </div>
      </div>

      {/* Disbursements Table */}
      <div className="bg-white rounded-3xl border border-[#E3DCCD] overflow-hidden shadow-xs">
        <div className="p-4 bg-[#FAF8F5] border-b border-[#E3DCCD] flex items-center justify-between select-none">
          <div>
            <h4 className="font-bold text-[#282824] text-xs sm:text-sm">
              سجل حركات السداد الفعلي للتدفقات النقدية ({formatNumber(report.entries.length)} حركة)
            </h4>
            <p className="text-[10px] text-[#68675F] mt-0.5">
              مرتبة تنازلياً بحسب تاريخ خروج المال الفعلي
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs border-collapse">
            <thead className="bg-[#FAF8F5] text-[#282824] font-bold border-b border-[#E3DCCD]">
              <tr>
                <th className="p-3">تاريخ الدفع الفعلي</th>
                <th className="p-3">رقم المصروف</th>
                <th className="p-3">التصنيف</th>
                <th className="p-3">مركز التكلفة</th>
                <th className="p-3">المستفيد / المورد</th>
                <th className="p-3">وصف الصرف المستندي</th>
                <th className="p-3">وسيلة السداد</th>
                <th className="p-3">رقم السند / المرجع</th>
                <th className="p-3 font-bold text-rose-800">المبلغ المسدد</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E3DCCD]">
              {report.entries.map((entry) => (
                <tr key={entry.paymentId} className="hover:bg-[#FFFCF6] transition-colors">
                  <td className="p-3 font-mono font-bold text-[#282824] whitespace-nowrap">
                    <bdi dir="ltr">{formatDate(entry.paymentDate)}</bdi>
                  </td>
                  <td className="p-3 font-mono font-semibold text-[#68675F] whitespace-nowrap" dir="ltr">
                    {formatNumber(entry.expenseNumber)}
                  </td>
                  <td className="p-3 whitespace-nowrap">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                      entry.isFfeOrEquipment
                        ? 'bg-purple-100 text-purple-900 border-purple-200'
                        : 'bg-[#FAF8F5] text-[#282824] border-[#E3DCCD]'
                    }`}>
                      {entry.categoryLabel}
                    </span>
                  </td>
                  <td className="p-3 whitespace-nowrap text-[#282824]">
                    {entry.propertyName ? `${entry.propertyName} ${entry.unitNumber ? `(#${formatNumber(entry.unitNumber)})` : ''}` : entry.level}
                  </td>
                  <td className="p-3 font-semibold text-[#282824] whitespace-nowrap">
                    {entry.vendorOrBeneficiary}
                  </td>
                  <td className="p-3 text-[#282824] max-w-xs leading-relaxed truncate">
                    <span title={entry.description}>{formatNumber(entry.description)}</span>
                  </td>
                  <td className="p-3 whitespace-nowrap text-[#68675F]">
                    {entry.paymentMethod}
                  </td>
                  <td className="p-3 font-mono text-[#68675F] whitespace-nowrap" dir="ltr">
                    {formatNumber(entry.receiptReference || '-')}
                  </td>
                  <td className="p-3 font-bold text-rose-800 whitespace-nowrap">
                    <CurrencyAmount amount={entry.amount} className="font-bold text-rose-800" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {report.entries.length === 0 && (
          <div className="p-8 text-center text-[#68675F] text-xs">
            لا توجد مدفوعات نقدية مسجلة خلال الفترة المحددة.
          </div>
        )}
      </div>

    </div>
  );
};
