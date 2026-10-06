import React, { useState, useMemo } from 'react';
import { useAppStore } from '../../../store/useAppStore';
import { generateTenantStatement } from '../../../utils/financialCalculations';
import { CurrencyAmount, formatDate, formatNumber } from '../../../utils/formatters';
import { GregorianDatePicker } from '../../common/GregorianDatePicker';
import {
  FileText,
  Printer,
  Download,
  CreditCard,
  CheckCircle2,
  AlertTriangle,
  BadgePercent,
  UserCheck
} from 'lucide-react';

interface Props {
  onOpenPaymentModal: (tenantNationalId?: string, defaultLeaseId?: string) => void;
  onOpenAdjustmentModal: (tenantNationalId?: string, defaultLeaseId?: string) => void;
  onOpenDepositSettleModal: (depositId?: string, defaultLeaseId?: string) => void;
}

export const TenantStatementView: React.FC<Props> = ({
  onOpenPaymentModal,
  onOpenAdjustmentModal,
  onOpenDepositSettleModal,
}) => {
  const { state } = useAppStore();

  // Filters
  const [selectedTenant, setSelectedTenant] = useState<string>('');
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>('all');
  const [selectedLeaseId, setSelectedLeaseId] = useState<string>('all');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  // Extract unique tenants from leases
  const uniqueTenants = useMemo(() => {
    const map = new Map<string, { name: string; nationalId: string; phone: string }>();
    (state.leases || []).forEach(l => {
      const key = l.tenant.nationalIdOrPassport || l.tenant.fullName;
      if (!map.has(key)) {
        map.set(key, {
          name: l.tenant.fullName,
          nationalId: l.tenant.nationalIdOrPassport,
          phone: l.tenant.phone,
        });
      }
    });
    return Array.from(map.values());
  }, [state.leases]);

  // Default to first tenant if none selected
  const activeTenantId = selectedTenant || uniqueTenants[0]?.nationalId || '';

  const statement = useMemo(() => {
    return generateTenantStatement(state, {
      tenantIdentifier: activeTenantId,
      propertyId: selectedPropertyId === 'all' ? undefined : selectedPropertyId,
      leaseId: selectedLeaseId === 'all' ? undefined : selectedLeaseId,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
    });
  }, [state, activeTenantId, selectedPropertyId, selectedLeaseId, startDate, endDate]);

  const handlePrint = () => {
    window.print();
  };

  const handleExportCSV = () => {
    const headers = ['التاريخ', 'فئة الحركة', 'رقم الحركة المستندي', 'رقم العقد', 'رقم الشقة', 'البيان ومبرر الصرف', 'المبلغ المدين', 'المبلغ الدائن', 'الرصيد الجاري المتبقي'];
    const rows = statement.entries.map(e => [
      e.date,
      e.type === 'due_rent' ? 'قسط إيجار' : e.type === 'payment_received' ? 'تحصيل دفعة' : e.type === 'adjustment' ? 'تسوية خصم' : 'أخرى',
      e.referenceNumber,
      e.contractNumber,
      e.unitNumber,
      `"${e.description.replace(/"/g, '""')}"`,
      e.debitAmount,
      e.creditAmount,
      e.runningBalance,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `statement-${statement.tenantName || 'tenant'}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 text-right">
      
      {/* Action and Filter Bar */}
      <div className="bg-white p-5 rounded-3xl border border-[#E3DCCD] shadow-xs space-y-4 print:hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-bold text-[#282824] flex items-center gap-2 justify-start">
              <FileText className="w-5 h-5 text-[#B69A68]" />
              <span>كشف الحساب الموحد للنزلاء والمستأجرين (Ledger)</span>
            </h3>
            <p className="text-xs text-[#68675F]">
              تتبع السجل المالي الكلي شامل الفواتير، التحصيلات البنكية، الخصومات، ومبالغ التأمين المعزولة
            </p>
          </div>
          
          <div className="flex flex-wrap items-center gap-2 select-none justify-start">
            <button
              onClick={() => onOpenPaymentModal(statement.nationalIdOrPassport, statement.associatedLeases[0]?.id)}
              className="px-3.5 py-2 bg-[#282824] hover:bg-[#1A1A17] text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors shadow-xs cursor-pointer"
            >
              <CreditCard className="w-4 h-4 text-[#B69A68]" />
              <span>تحصيل دفعة مالية</span>
            </button>
            <button
              onClick={() => onOpenAdjustmentModal(statement.nationalIdOrPassport, statement.associatedLeases[0]?.id)}
              className="px-3.5 py-2 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <BadgePercent className="w-4 h-4 text-amber-700" />
              <span>إجراء خصم وتسوية</span>
            </button>
            <button
              onClick={handleExportCSV}
              className="px-3 py-2 bg-[#F7F3EB] hover:bg-[#EFE9DF] text-[#282824] rounded-xl text-xs font-medium flex items-center gap-1.5 transition-colors border border-[#E3DCCD] cursor-pointer"
              title="تصدير ككشف Excel/CSV"
            >
              <Download className="w-4 h-4 text-[#68675F]" />
              <span>تصدير Excel</span>
            </button>
            <button
              onClick={handlePrint}
              className="px-3 py-2 bg-[#F7F3EB] hover:bg-[#EFE9DF] text-[#282824] rounded-xl text-xs font-medium flex items-center gap-1.5 transition-colors border border-[#E3DCCD] cursor-pointer"
              title="طباعة كشف الحساب"
            >
              <Printer className="w-4 h-4 text-[#68675F]" />
              <span>طباعة الكشف</span>
            </button>
          </div>
        </div>

        {/* Filter Controls */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 pt-3 border-t border-[#E3DCCD]">
          <div>
            <label className="block text-[11px] font-bold text-[#68675F] mb-1">اختر اسم المستأجر الحالي</label>
            <select
              value={activeTenantId}
              onChange={(e) => setSelectedTenant(e.target.value)}
              className="w-full bg-[#FAF8F5] border border-[#E3DCCD] rounded-xl px-3 py-2 text-xs text-[#282824] font-medium focus:ring-1 focus:ring-[#B69A68] cursor-pointer"
            >
              {uniqueTenants.map(t => (
                <option key={t.nationalId || t.name} value={t.nationalId || t.name}>
                  {t.name} ({formatNumber(t.nationalId)})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-bold text-[#68675F] mb-1">المجمع السكني</label>
            <select
              value={selectedPropertyId}
              onChange={(e) => setSelectedPropertyId(e.target.value)}
              className="w-full bg-[#FAF8F5] border border-[#E3DCCD] rounded-xl px-3 py-2 text-xs text-[#282824] font-medium focus:ring-1 focus:ring-[#B69A68] cursor-pointer"
            >
              <option value="all">جميع المجمعات السكنية</option>
              {state.properties.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-bold text-[#68675F] mb-1">من تاريخ الحركات</label>
            <GregorianDatePicker
              value={startDate}
              onChange={(val) => setStartDate(val)}
              placeholder="اختر تاريخ البداية"
              className="w-full"
            />
          </div>
          <div>
            <label className="block text-[11px] font-bold text-[#68675F] mb-1">إلى تاريخ الحركات</label>
            <GregorianDatePicker
              value={endDate}
              onChange={(val) => setEndDate(val)}
              placeholder="اختر تاريخ النهاية"
              className="w-full"
            />
          </div>
        </div>
      </div>

      {/* Statement Sheet (Print friendly) */}
      <div className="bg-white rounded-3xl border border-[#E3DCCD] p-6 shadow-xs space-y-6 print:border-none print:shadow-none print:p-0">
        
        {/* Printable Header */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-start justify-between gap-4 border-b border-[#E3DCCD] pb-5">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-lg sm:text-xl font-black text-[#282824] tracking-tight whitespace-nowrap">{state.settings.companyName}</span>
              <span className="text-xs bg-[#F7F3EB] text-[#B69A68] px-2.5 py-1 rounded-lg font-bold select-none whitespace-nowrap">كشف حساب مستأجر رسمي</span>
            </div>
            <p className="text-xs text-[#68675F]">الرقم الضريبي الكلي: <span className="font-mono tabular-nums" dir="ltr">{formatNumber(state.settings.taxNumber)}</span></p>
            <p className="text-xs text-[#68675F]">توقيت الطباعة: <bdi dir="ltr" className="font-mono tabular-nums">{formatDate(new Date().toISOString().slice(0, 10))}</bdi> · <bdi dir="ltr" className="font-mono tabular-nums">{new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false })}</bdi></p>
          </div>
          
          <div className="bg-[#FAF8F5] p-3.5 rounded-2xl border border-[#E3DCCD] w-full sm:w-auto sm:min-w-[250px] text-right space-y-1">
            <h4 className="text-xs font-bold text-[#282824] mb-1 flex items-center gap-1.5 justify-start sm:justify-end">
              <UserCheck className="w-3.5 h-3.5 text-[#B69A68]" />
              <span>بيانات المستأجر الرئيسي</span>
            </h4>
            <div className="text-xs sm:text-sm text-[#282824] font-bold break-words">{statement.tenantName}</div>
            <div className="text-[11px] text-[#68675F]">رقم الهوية / السجل: <span className="font-mono tabular-nums" dir="ltr">{formatNumber(statement.nationalIdOrPassport || '-')}</span></div>
            <div className="text-[11px] text-[#68675F]">رقم الجوال الفعال: <span className="font-mono tabular-nums" dir="ltr">{formatNumber(statement.phone || '-')}</span></div>
            <div className="text-[11px] text-[#68675F]">عدد العقود النشطة: <span className="font-bold tabular-nums" dir="ltr">{formatNumber(statement.associatedLeases.length)}</span> عقود</div>
          </div>
        </div>

        {/* Financial Summary Metric Badges */}
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3 select-none">
          <div className="p-3 bg-[#FAF8F5] rounded-2xl border border-[#E3DCCD]">
            <span className="block text-[10px] font-bold text-[#68675F] mb-1">المفوتر الكلي المجمع</span>
            <CurrencyAmount amount={statement.summary.totalInvoiced} className="text-base font-bold text-[#282824]" />
          </div>
          <div className="p-3 bg-[#FAF8F5] rounded-2xl border border-[#E3DCCD]">
            <span className="block text-[10px] font-bold text-[#68675F] mb-1">المستحق حتى اليوم</span>
            <CurrencyAmount amount={statement.summary.dueToDate} className="text-base font-bold text-[#282824]" />
          </div>
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl">
            <span className="block text-[10px] font-bold text-rose-800 mb-1">المتأخر الفعلي الدائن</span>
            <CurrencyAmount amount={statement.summary.overdueAmount} className="text-base font-bold text-rose-700" />
          </div>
          <div className="p-3 bg-[#FAF8F5] rounded-2xl border border-[#E3DCCD]">
            <span className="block text-[10px] font-bold text-[#68675F] mb-1">أقساط مستقبلية معلقة</span>
            <CurrencyAmount amount={statement.summary.futureDues} className="text-base font-bold text-[#68675F]" />
          </div>
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl">
            <span className="block text-[10px] font-bold text-emerald-800 mb-1">المحصل والمسدد فعلاً</span>
            <CurrencyAmount amount={statement.summary.totalCollected} className="text-base font-bold text-emerald-700" />
          </div>
          <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-2xl">
            <span className="block text-[10px] font-bold text-indigo-900 mb-1">الرصيد الدائن المستجد</span>
            <CurrencyAmount amount={statement.summary.unallocatedCredit} className="text-base font-bold text-indigo-700" />
          </div>
        </div>

        {/* Running Balance Banner */}
        <div className="flex items-center justify-between p-4 bg-[#282824] text-white rounded-2xl select-none text-right">
          <div>
            <span className="text-xs text-stone-300 block">صافي الرصيد المستحق الدفع (Net Balance Due)</span>
            <div className="text-2xl font-black text-[#E8D7B0]">
              <CurrencyAmount amount={statement.summary.currentNetBalance} className="text-2xl font-black text-[#E8D7B0]" />
            </div>
          </div>
          {statement.summary.currentNetBalance > 0 ? (
            <div>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-500/20 text-amber-300 rounded-full text-xs font-bold border border-amber-500/30">
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>مستحق السداد</span>
              </span>
            </div>
          ) : (
            <div>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-500/20 text-emerald-300 rounded-full text-xs font-bold border border-emerald-500/30">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>الحساب منتظم ومتعادل</span>
              </span>
            </div>
          )}
        </div>

        {/* Detailed Ledger Entries Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs border-collapse">
            <thead className="bg-[#FAF8F5] text-[#282824] font-bold">
              <tr className="border-b border-[#E3DCCD]">
                <th className="p-3">التاريخ المالي</th>
                <th className="p-3">نوع الحركة</th>
                <th className="p-3">رقم الحركة المستندي</th>
                <th className="p-3">رقم العقد والشقة</th>
                <th className="p-3">البيان ومبرر الصرف</th>
                <th className="p-3 text-rose-800 font-bold">مدين (مستحق)</th>
                <th className="p-3 text-emerald-800 font-bold">دائن (محصل)</th>
                <th className="p-3 font-black">الرصيد الجاري المتبقي</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E3DCCD]">
              {statement.entries.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-[#68675F]">
                    لا توجد حركات مالية مسجلة على المستأجر حالياً تطابق معايير التصفية.
                  </td>
                </tr>
              ) : (
                statement.entries.map((entry) => (
                  <tr key={entry.id} className="hover:bg-[#FFFCF6] transition-colors">
                    <td className="p-3 font-medium text-[#282824] whitespace-nowrap">
                      <bdi dir="ltr" className="tabular-nums font-mono">{formatDate(entry.date)}</bdi>
                    </td>
                    <td className="p-3">
                      <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold ${
                        entry.type === 'due_rent'
                          ? 'bg-amber-100 text-amber-900'
                          : entry.type === 'payment_received'
                          ? 'bg-emerald-100 text-emerald-900'
                          : 'bg-indigo-100 text-indigo-900'
                      }`}>
                        {entry.type === 'due_rent' && 'قسط إيجاري مفوتر'}
                        {entry.type === 'due_service' && 'فاتورة خدمات تجاوز'}
                        {entry.type === 'payment_received' && 'تحصيل سند سداد'}
                        {entry.type === 'adjustment' && 'تسوية خصم معتمد'}
                        {entry.type === 'refund' && 'إرجاع مالي'}
                        {entry.type === 'deposit_hold' && 'تأمين محتجز'}
                      </span>
                    </td>
                    <td className="p-3 font-mono text-[11px] text-[#68675F] whitespace-nowrap select-all" dir="ltr">
                      {formatNumber(entry.referenceNumber)}
                    </td>
                    <td className="p-3 whitespace-nowrap">
                      <strong className="block text-[#282824] text-[11px]" dir="ltr">{formatNumber(entry.contractNumber)}</strong>
                      <span className="text-[10px] text-[#68675F]">وحدة سكنية #{formatNumber(entry.unitNumber)}</span>
                    </td>
                    <td className="p-3 max-w-[280px] text-[#68675F] text-[11px] leading-relaxed">
                      {formatNumber(entry.description)}
                    </td>
                    <td className="p-3 font-bold text-rose-700 whitespace-nowrap">
                      {entry.debitAmount > 0 ? <CurrencyAmount amount={entry.debitAmount} className="text-rose-700 font-bold" /> : '-'}
                    </td>
                    <td className="p-3 font-bold text-emerald-700 whitespace-nowrap">
                      {entry.creditAmount > 0 ? <CurrencyAmount amount={entry.creditAmount} className="text-emerald-700 font-bold" /> : '-'}
                    </td>
                    <td className="p-3 font-black text-[#282824] whitespace-nowrap">
                      <CurrencyAmount amount={entry.runningBalance} className="font-black text-[#282824]" />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* ISOLATED SECURITY DEPOSIT SECTION */}
        <div className="pt-5 border-t border-[#E3DCCD] space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="p-2 bg-[#FAF8F5] border border-[#E3DCCD] rounded-xl text-[#B69A68] text-xs">
                🛡️
              </span>
              <div>
                <h4 className="text-xs font-bold text-[#282824]">ودائع تأمين السكن المعزولة (Security Deposits)</h4>
                <p className="text-[11px] text-[#68675F]">
                  سجل الودائع المحتجزة للأثاث والضرر المستردة بالكامل عند تسليم الوحدة خالية من العيوب
                </p>
              </div>
            </div>
            
            <div className="text-left bg-amber-50 px-3.5 py-1.5 rounded-xl border border-amber-200 text-right">
              <span className="text-[10px] text-amber-900 block font-semibold">رصيد الودائع المحتجز الفعال حالياً</span>
              <div className="text-sm font-black text-amber-950">
                <CurrencyAmount amount={statement.summary.securityDepositHeld} className="text-amber-950 font-black" />
              </div>
            </div>
          </div>

          <div className="bg-[#FAF8F5] rounded-2xl border border-[#E3DCCD] p-3 overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead>
                <tr className="text-[#68675F] text-[11px] font-bold">
                  <th className="p-2">رقم التأمين المستندي</th>
                  <th className="p-2">رقم الحجز أو العقد</th>
                  <th className="p-2">وديعة التأمين الكلية</th>
                  <th className="p-2">اقتطاعات تلفيات معتمدة</th>
                  <th className="p-2">الرصيد المتاح المتبقي</th>
                  <th className="p-2">حالة التأمين الأمني</th>
                  <th className="p-2 text-left print:hidden">العملية المتاحة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E3DCCD]/60">
                {statement.associatedDeposits.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-3 text-center text-[#68675F]">
                      لا توجد ودائع تأمين أثاث محتجزة أو مسجلة لهذا المستأجر تاريخياً.
                    </td>
                  </tr>
                ) : (
                  statement.associatedDeposits.map(d => {
                    const deducted = (d.deductions || []).reduce((s, x) => s + x.amount, 0);
                    const available = Math.max(0, d.amount - deducted);
                    return (
                      <tr key={d.id} className="hover:bg-white/80">
                        <td className="p-2 font-mono text-[11px] select-all" dir="ltr">{formatNumber(d.id)}</td>
                        <td className="p-2 font-medium font-mono" dir="ltr">{formatNumber(d.bookingOrLeaseId)}</td>
                        <td className="p-2 font-bold whitespace-nowrap"><CurrencyAmount amount={d.amount} /></td>
                        <td className="p-2 text-rose-700 font-medium whitespace-nowrap">
                          {deducted > 0 ? <CurrencyAmount amount={deducted} className="text-rose-700 font-medium" /> : '-'}
                        </td>
                        <td className="p-2 font-black text-[#282824] whitespace-nowrap"><CurrencyAmount amount={available} className="font-black text-[#282824]" /></td>
                        <td className="p-2">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            d.status === 'held' ? 'bg-amber-100 text-amber-900' : 'bg-emerald-100 text-emerald-900'
                          }`}>
                            {d.status === 'held' ? 'محتجز لدى الصندوق' : 'تم تسوية الإرجاع'}
                          </span>
                        </td>
                        <td className="p-2 text-left print:hidden">
                          {available > 0 && d.status === 'held' && (
                            <button
                              onClick={() => onOpenDepositSettleModal(d.id, d.bookingOrLeaseId)}
                              className="px-2.5 py-1 bg-white hover:bg-stone-100 text-[#282824] border border-[#E3DCCD] rounded-lg text-[10px] font-bold cursor-pointer"
                            >
                              تسوية لسداد قسط مالي
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
};
