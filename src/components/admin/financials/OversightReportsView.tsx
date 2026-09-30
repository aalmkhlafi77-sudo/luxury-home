import React, { useState, useMemo } from 'react';
import { useAppStore } from '../../../store/useAppStore';
import {
  calculateAgingReport,
  calculateCashFlowForecast,
  calculateOccupancyFinancials
} from '../../../utils/financialCalculations';
import {
  TrendingUp,
  Clock,
  AlertTriangle,
  Percent,
  CheckCircle2
} from 'lucide-react';

export const OversightReportsView: React.FC = () => {
  const { state } = useAppStore();
  const [subTab, setSubTab] = useState<'aging' | 'cashflow' | 'occupancy'>('aging');

  const agingData = useMemo(() => calculateAgingReport(state), [state]);
  const cashflowData = useMemo(() => calculateCashFlowForecast(state), [state]);
  const occupancyData = useMemo(() => calculateOccupancyFinancials(state), [state]);

  return (
    <div className="space-y-6 text-right">
      
      {/* Subtab selection */}
      <div className="flex items-center gap-2 p-1 bg-white rounded-2xl border border-[#E3DCCD] w-fit select-none">
        <button
          onClick={() => setSubTab('aging')}
          className={`px-4 py-2 rounded-xl font-bold transition-all flex items-center gap-1.5 text-xs cursor-pointer ${
            subTab === 'aging' ? 'bg-[#282824] text-white shadow-xs' : 'text-[#68675F] hover:text-[#282824]'
          }`}
        >
          <Clock className="w-4 h-4 text-[#B69A68]" />
          <span>ديون النزلاء المتأخرة ({agingData.totalOverdue.toLocaleString('ar-SA')} ر.س)</span>
        </button>
        <button
          onClick={() => setSubTab('cashflow')}
          className={`px-4 py-2 rounded-xl font-bold transition-all flex items-center gap-1.5 text-xs cursor-pointer ${
            subTab === 'cashflow' ? 'bg-[#282824] text-white shadow-xs' : 'text-[#68675F] hover:text-[#282824]'
          }`}
        >
          <TrendingUp className="w-4 h-4 text-[#B69A68]" />
          <span>التدفقات المالية المتوقعة ({cashflowData.totalProjectedInflow.toLocaleString('ar-SA')} ر.س)</span>
        </button>
        <button
          onClick={() => setSubTab('occupancy')}
          className={`px-4 py-2 rounded-xl font-bold transition-all flex items-center gap-1.5 text-xs cursor-pointer ${
            subTab === 'occupancy' ? 'bg-[#282824] text-white shadow-xs' : 'text-[#68675F] hover:text-[#282824]'
          }`}
        >
          <Percent className="w-4 h-4 text-[#B69A68]" />
          <span>نسب الإشغال والتحصيل</span>
        </button>
      </div>

      {/* 1. AGING OF RECEIVABLES REPORT */}
      {subTab === 'aging' && (
        <div className="space-y-6 animate-in fade-in duration-150">
          
          {/* Top Aging Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 select-none">
            <div className="bg-white p-4 rounded-3xl border border-amber-200 bg-amber-50/40 shadow-xs">
              <div className="flex items-center justify-between text-xs text-amber-900 font-bold mb-1">
                <span>١ - ٣٠ يوم (متأخرات حديثة)</span>
                <span className="text-[10px] bg-amber-200/60 px-2 py-0.5 rounded-full tabular-nums">{agingData?.buckets?.under30?.count || 0} أقساط</span>
              </div>
              <div className="text-xl font-black text-amber-950 tabular-nums">
                {(agingData?.buckets?.under30?.totalAmount || 0).toLocaleString('ar-SA')} ر.س
              </div>
              <div className="text-[10px] text-amber-800 mt-1">تنبيهات تلقائية مبرمجة بالجوال</div>
            </div>

            <div className="bg-white p-4 rounded-3xl border border-orange-200 bg-orange-50/40 shadow-xs">
              <div className="flex items-center justify-between text-xs text-orange-900 font-bold mb-1">
                <span>٣١ - ٦٠ يوم (متأخرات متوسطة)</span>
                <span className="text-[10px] bg-orange-200/60 px-2 py-0.5 rounded-full tabular-nums">{agingData?.buckets?.days30to60?.count || 0} أقساط</span>
              </div>
              <div className="text-xl font-black text-orange-950 tabular-nums">
                {(agingData?.buckets?.days30to60?.totalAmount || 0).toLocaleString('ar-SA')} ر.س
              </div>
              <div className="text-[10px] text-orange-800 mt-1">إرسال إشعار رسمي ثانٍ للنزيل</div>
            </div>

            <div className="bg-white p-4 rounded-3xl border border-rose-200 bg-rose-50/40 shadow-xs">
              <div className="flex items-center justify-between text-xs text-rose-900 font-bold mb-1">
                <span>٦١ - ٩٠ يوم (عالية الخطورة)</span>
                <span className="text-[10px] bg-rose-200/60 px-2 py-0.5 rounded-full tabular-nums">{agingData?.buckets?.days60to90?.count || 0} أقساط</span>
              </div>
              <div className="text-xl font-black text-rose-950 tabular-nums">
                {(agingData?.buckets?.days60to90?.totalAmount || 0).toLocaleString('ar-SA')} ر.س
              </div>
              <div className="text-[10px] text-rose-800 mt-1">تكليف مكتب تحصيل معتمد</div>
            </div>

            <div className="bg-white p-4 rounded-3xl border border-red-300 bg-red-100/50 shadow-xs">
              <div className="flex items-center justify-between text-xs text-red-950 font-bold mb-1">
                <span>أكثر من ٩٠ يوم (ديون متعثرة)</span>
                <span className="text-[10px] bg-red-300 px-2 py-0.5 rounded-full tabular-nums">{agingData?.buckets?.over90?.count || 0} أقساط</span>
              </div>
              <div className="text-xl font-black text-red-950 tabular-nums">
                {(agingData?.buckets?.over90?.totalAmount || 0).toLocaleString('ar-SA')} ر.س
              </div>
              <div className="text-[10px] text-red-900 mt-1">رفع دعوى قضائية للتنفيذ</div>
            </div>
          </div>

          {/* Aging Breakdown Table */}
          <div className="bg-white rounded-3xl border border-[#E3DCCD] p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#E3DCCD]/50">
              <div>
                <h4 className="text-sm font-bold text-[#282824]">قائمة كشوفات النزلاء المتأخرين بالسداد</h4>
                <p className="text-xs text-[#68675F] mt-1">
                  إجمالي ذمم النزلاء المتأخرة: <strong className="text-rose-700 tabular-nums">{agingData.totalOverdue.toLocaleString('ar-SA')} ر.س</strong> موزع على {agingData.totalDelinquentTenantsCount} مستأجر متعثر.
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs border-collapse">
                <thead className="bg-[#FAF8F5] text-[#282824] font-bold">
                  <tr>
                    <th className="p-3">اسم المستأجر والتواصل</th>
                    <th className="p-3">المشروع والوحدة السكنية</th>
                    <th className="p-3">رقم العقد ودفعة القسط</th>
                    <th className="p-3">تاريخ الاستحقاق المستند</th>
                    <th className="p-3 font-bold text-rose-800">أيام التأخر</th>
                    <th className="p-3">درجة تصنيف المديونية</th>
                    <th className="p-3 font-bold text-rose-800">المبلغ المتأخر</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E3DCCD]">
                  {agingData.totalOverdue === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-emerald-800 font-bold">
                        ✓ تهانينا! لا توجد مستحقات مالية متأخرة أو ديون سكنية غير محصلة حالياً.
                      </td>
                    </tr>
                  ) : (
                    [
                      ...agingData.buckets.under30.installments.map(i => ({ ...i, bucket: '١ - ٣٠ يوم', badgeBg: 'bg-amber-100 text-amber-900' })),
                      ...agingData.buckets.days30to60.installments.map(i => ({ ...i, bucket: '٣١ - ٦٠ يوم', badgeBg: 'bg-orange-100 text-orange-900' })),
                      ...agingData.buckets.days60to90.installments.map(i => ({ ...i, bucket: '٦١ - ٩٠ يوم', badgeBg: 'bg-rose-100 text-rose-900' })),
                      ...agingData.buckets.over90.installments.map(i => ({ ...i, bucket: 'أكثر من ٩٠ يوم', badgeBg: 'bg-red-200 text-red-950 font-black' })),
                    ].map((item, idx) => (
                      <tr key={idx} className="hover:bg-[#FFFCF6] transition-colors">
                        <td className="p-3">
                          <strong className="block text-[#282824]">{item.tenantName}</strong>
                          <span className="text-[10px] text-[#68675F]" dir="ltr">{item.tenantPhone}</span>
                        </td>
                        <td className="p-3">
                          <span className="block text-[#282824] font-medium">{item.propertyName}</span>
                          <span className="text-[10px] text-[#68675F]">شقة رقم #{item.unitNumber}</span>
                        </td>
                        <td className="p-3">
                          <strong className="block text-[#282824] font-mono select-all">{item.contractNumber}</strong>
                          <span className="text-[10px] text-[#68675F]">{item.label}</span>
                        </td>
                        <td className="p-3 tabular-nums font-medium text-[#282824]">{item.dueDate}</td>
                        <td className="p-3 font-bold text-rose-700 tabular-nums">{item.daysOverdue} يوم متأخر</td>
                        <td className="p-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${item.badgeBg}`}>
                            {item.bucket}
                          </span>
                        </td>
                        <td className="p-3 font-black text-rose-800 tabular-nums">
                          {item.remainingAmount.toLocaleString('ar-SA')} ر.س
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 2. CASH FLOW FORECAST REPORT */}
      {subTab === 'cashflow' && (
        <div className="space-y-6 animate-in fade-in duration-150">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 select-none">
            <div className="bg-white p-5 rounded-3xl border border-[#E3DCCD] shadow-xs">
              <span className="text-xs text-[#68675F] block mb-1">الأيام الـ ٣٠ القادمة (شهر)</span>
              <span className="text-2xl font-black text-[#282824] tabular-nums">
                {cashflowData.next30Days.expectedInflow.toLocaleString('ar-SA')} ر.س
              </span>
              <span className="block text-[11px] text-[#B69A68] font-bold mt-1">
                توقع تحصيل عدد {cashflowData.next30Days.count} أقساط مجدولة
              </span>
            </div>
            <div className="bg-white p-5 rounded-3xl border border-[#E3DCCD] shadow-xs">
              <span className="text-xs text-[#68675F] block mb-1">الربع القادم (من ٣١ إلى ٩٠ يوم)</span>
              <span className="text-2xl font-black text-[#282824] tabular-nums">
                {cashflowData.nextQuarter.expectedInflow.toLocaleString('ar-SA')} ر.س
              </span>
              <span className="block text-[11px] text-[#B69A68] font-bold mt-1">
                توقع تحصيل عدد {cashflowData.nextQuarter.count} أقساط مجدولة
              </span>
            </div>
            <div className="bg-white p-5 rounded-3xl border border-[#E3DCCD] shadow-xs">
              <span className="text-xs text-[#68675F] block mb-1">باقي العام (من ٩١ إلى ٣٦٥ يوم)</span>
              <span className="text-2xl font-black text-[#282824] tabular-nums">
                {cashflowData.nextYear.expectedInflow.toLocaleString('ar-SA')} ر.س
              </span>
              <span className="block text-[11px] text-[#B69A68] font-bold mt-1">
                توقع تحصيل عدد {cashflowData.nextYear.count} أقساط مجدولة
              </span>
            </div>
          </div>

          <div className="bg-white rounded-3xl border border-[#E3DCCD] p-6 shadow-xs space-y-4">
            <h4 className="text-sm font-bold text-[#282824]">التدفقات النقدية المتوقعة وجدول سداد التحصيلات المجدولة</h4>
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs border-collapse">
                <thead className="bg-[#FAF8F5] text-[#282824] font-bold">
                  <tr>
                    <th className="p-3">تاريخ الاستحقاق المتوقع</th>
                    <th className="p-3">اسم المستأجر الرئيسي</th>
                    <th className="p-3">رقم العقد ودفعة القسط</th>
                    <th className="p-3">رقم شقة السكن</th>
                    <th className="p-3 font-bold text-emerald-800">قيمة التدفق المتوقع</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E3DCCD]">
                  {[
                    ...cashflowData.next30Days.installments,
                    ...cashflowData.nextQuarter.installments,
                    ...cashflowData.nextYear.installments,
                  ].map((item, idx) => (
                    <tr key={idx} className="hover:bg-[#FFFCF6] transition-colors">
                      <td className="p-3 font-medium text-[#282824] tabular-nums">{item.dueDate}</td>
                      <td className="p-3 font-bold text-[#282824]">{item.tenantName}</td>
                      <td className="p-3 text-[#68675F]">
                        <span className="block text-[#282824] font-semibold font-mono select-all">{item.contractNumber}</span>
                        <span>{item.propertyName}</span>
                      </td>
                      <td className="p-3 font-bold text-[#282824]">شقة #{item.unitNumber}</td>
                      <td className="p-3 font-black text-emerald-700 tabular-nums">
                        {item.remainingAmount.toLocaleString('ar-SA')} ر.س
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 3. OCCUPANCY AND VARIANCE REPORT */}
      {subTab === 'occupancy' && (
        <div className="space-y-6 animate-in fade-in duration-150">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 select-none">
            <div className="bg-white p-5 rounded-3xl border border-[#E3DCCD]">
              <span className="text-xs text-[#68675F] block mb-1">معدل الإشغال الكلي للمجمع</span>
              <span className="text-2xl font-black text-[#282824] tabular-nums">{occupancyData.occupancyRate}%</span>
              <span className="text-[10px] text-[#68675F] block mt-1">
                تشغل {occupancyData.occupiedCount} شقة من أصل {occupancyData.totalUnitsCount} وحدة سكنية متوفرة
              </span>
            </div>
            <div className="bg-white p-5 rounded-3xl border border-[#E3DCCD]">
              <span className="text-xs text-[#68675F] block mb-1">الهدف الشهري الإجمالي المتوقع</span>
              <span className="text-2xl font-black text-[#282824] tabular-nums">
                {occupancyData.monthlyPotentialRevenue.toLocaleString('ar-SA')} ر.س
              </span>
              <span className="text-[10px] text-[#68675F] block mt-1">بفرض إشغال ١٠٠٪ للغرف</span>
            </div>
            <div className="bg-white p-5 rounded-3xl border border-rose-200 bg-rose-50/40">
              <span className="text-xs text-rose-800 block mb-1">خسارة الشواغر (Vacancy Loss)</span>
              <span className="text-2xl font-black text-rose-700 tabular-nums">
                {occupancyData.vacancyLossMonthly.toLocaleString('ar-SA')} ر.س
              </span>
              <span className="text-[10px] text-rose-800 block mt-1">
                ناتج عن {occupancyData.vacantCount} شقة شاغرة غير مسكونة
              </span>
            </div>
            <div className="bg-white p-5 rounded-3xl border border-emerald-200 bg-emerald-50/40">
              <span className="text-xs text-emerald-800 block mb-1">كفاءة ونسبة التحصيل الفعلي</span>
              <span className="text-2xl font-black text-emerald-700 tabular-nums">{occupancyData.collectionEfficiency}%</span>
              <span className="text-[10px] text-emerald-800 block mt-1">
                إجمالي المحصل النقدي هذا الشهر: {occupancyData.cashCollectedThisMonth.toLocaleString('ar-SA')} ر.س
              </span>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
