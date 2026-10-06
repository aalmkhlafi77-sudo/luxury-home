import React, { useState } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { formatNumber, formatDate, CurrencyAmount } from '../../utils/formatters';
import {
  CalendarDays,
  FileText,
  Search,
  LogIn,
  LogOut,
  ShieldCheck,
  Building2,
  XCircle,
  AlertTriangle,
  Info,
  Clock,
  CheckCircle2,
  RotateCcw,
  Eye,
  X
} from 'lucide-react';

export const BookingsLeasesManager: React.FC = () => {
  const { state } = useAppStore();
  const [activeTab, setActiveTab] = useState<'all' | 'daily' | 'monthly' | 'yearly'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Early termination modal state
  const [terminateModalLease, setTerminateModalLease] = useState<any | null>(null);
  const [terminationDate, setTerminationDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [terminationReason, setTerminationReason] = useState<string>('إنهاء رضائي مبكر مع تسوية الحسابات');

  // Lease details modal state
  const [selectedLeaseDetails, setSelectedLeaseDetails] = useState<any | null>(null);

  const filteredBookings = state.bookings.filter(b => {
    if (activeTab === 'monthly' || activeTab === 'yearly') return false;
    if (!searchQuery) return true;
    return (
      b.bookingNumber?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.guest?.fullName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.guest?.phone?.includes(searchQuery)
    );
  });

  const filteredLeases = state.leases.filter(l => {
    if (activeTab === 'daily') return false;
    const isYearly = l.rentalType === 'yearly' || (l as any).type === 'yearly' || (l as any).rentalType === 'annual';
    if (activeTab === 'monthly' && isYearly) return false;
    if (activeTab === 'yearly' && !isYearly) return false;
    if (!searchQuery) return true;
    return (
      l.contractNumber?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      l.tenant?.fullName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      l.tenant?.phone?.includes(searchQuery)
    );
  });

  // Action handlers calling the authoritative server API
  const handleCheckIn = async (bookingId: string) => {
    setActionError(null);
    setActionSuccess(null);
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/bookings/${bookingId}/check-in`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('luxury_home_jwt_token')}`
        }
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'فشل تسجيل الدخول.');
      }
      setActionSuccess('تم تسجيل دخول النزيل وتحديث إشغال الوحدة بنجاح.');
      // Refresh local store
      const booking = state.bookings.find(b => b.id === bookingId);
      if (booking) booking.status = 'checked_in';
    } catch (e: any) {
      setActionError(e.message || 'حدث خطأ أثناء تسجيل الدخول.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCheckOut = async (bookingId: string) => {
    setActionError(null);
    setActionSuccess(null);
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/bookings/${bookingId}/check-out`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('luxury_home_jwt_token')}`
        }
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'فشل تسجيل الخروج.');
      }
      setActionSuccess('تم تسجيل خروج النزيل وإحالة الوحدة للتجهيز الفندقي بنجاح.');
      const booking = state.bookings.find(b => b.id === bookingId);
      if (booking) booking.status = 'completed';
    } catch (e: any) {
      setActionError(e.message || 'حدث خطأ أثناء تسجيل الخروج.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancelBooking = async (bookingId: string) => {
    if (!window.confirm('هل أنت متأكد من رغبتك في إلغاء هذا الحجز؟ سيتم تحرير الفترة لإعادة الحجز ونقل التأمين للمراجعة.')) {
      return;
    }
    setActionError(null);
    setActionSuccess(null);
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/bookings/${bookingId}/cancel`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('luxury_home_jwt_token')}`
        }
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'فشل إلغاء الحجز.');
      }
      setActionSuccess('تم إلغاء الحجز بنجاح وتحرير تخصيص الوحدة.');
      const booking = state.bookings.find(b => b.id === bookingId);
      if (booking) booking.status = 'cancelled';
    } catch (e: any) {
      setActionError(e.message || 'حدث خطأ أثناء إلغاء الحجز.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEarlyTerminateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!terminateModalLease) return;
    setActionError(null);
    setActionSuccess(null);
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/leases/${terminateModalLease.id}/terminate-early`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('luxury_home_jwt_token')}`
        },
        body: JSON.stringify({
          terminationDate,
          reason: terminationReason
        })
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'فشل إنهاء العقد.');
      }
      setActionSuccess('تم توثيق الإنهاء المبكر وتعديل التخصيص الزمني بنجاح.');
      terminateModalLease.status = 'terminated_early';
      terminateModalLease.endDate = terminationDate;
      setTerminateModalLease(null);
    } catch (e: any) {
      setActionError(e.message || 'حدث خطأ أثناء إنهاء العقد.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 text-xs text-right">
      
      {/* Alert Notifications */}
      {actionError && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-rose-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
            <span>{actionError}</span>
          </div>
          <button onClick={() => setActionError(null)} className="p-1 hover:bg-rose-100 rounded-lg">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {actionSuccess && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span>{actionSuccess}</span>
          </div>
          <button onClick={() => setActionSuccess(null)} className="p-1 hover:bg-emerald-100 rounded-lg">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Header & Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 bg-white rounded-3xl border border-[#E3DCCD]">
        <div className="flex items-center gap-1.5 p-1 bg-[#F7F3EB] rounded-xl select-none overflow-x-auto custom-horizontal-scrollbar max-w-full">
          <button
            onClick={() => setActiveTab('all')}
            className={`px-3.5 py-2 rounded-lg font-bold transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              activeTab === 'all' ? 'bg-[#282824] text-white shadow-xs' : 'text-[#68675F] hover:text-[#282824]'
            }`}
          >
            <span>جميع المعاملات ({state.bookings.length + state.leases.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('daily')}
            className={`px-3.5 py-2 rounded-lg font-bold transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              activeTab === 'daily' ? 'bg-[#282824] text-white shadow-xs' : 'text-[#68675F] hover:text-[#282824]'
            }`}
          >
            <CalendarDays className="w-4 h-4 text-[#B69A68]" />
            <span>حجوزات يومية ({state.bookings.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('monthly')}
            className={`px-3.5 py-2 rounded-lg font-bold transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              activeTab === 'monthly' ? 'bg-[#282824] text-white shadow-xs' : 'text-[#68675F] hover:text-[#282824]'
            }`}
          >
            <FileText className="w-4 h-4 text-[#B69A68]" />
            <span>عقود شهرية ({state.leases.filter(l => l.type === 'monthly' || l.rentalType === 'monthly').length})</span>
          </button>

          <button
            onClick={() => setActiveTab('yearly')}
            className={`px-3.5 py-2 rounded-lg font-bold transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              activeTab === 'yearly' ? 'bg-[#282824] text-white shadow-xs' : 'text-[#68675F] hover:text-[#282824]'
            }`}
          >
            <ShieldCheck className="w-4 h-4 text-[#B69A68]" />
            <span>عقود سنوية ({state.leases.filter(l => l.rentalType === 'yearly' || (l as any).type === 'yearly' || (l as any).rentalType === 'annual').length})</span>
          </button>
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 text-[#68675F] absolute right-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="ابحث برقم المعاملة، الاسم، الهاتف..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-3 pr-9 py-2 bg-[#F7F3EB]/60 border border-[#E3DCCD] rounded-xl focus:outline-none focus:border-[#B69A68] text-right"
          />
        </div>
      </div>

      {/* Daily Bookings Table */}
      {(activeTab === 'all' || activeTab === 'daily') && filteredBookings.length > 0 && (
        <div className="bg-white rounded-3xl border border-[#E3DCCD] overflow-hidden shadow-xs">
          <div className="p-4 bg-[#F7F3EB] border-b border-[#E3DCCD] font-bold text-sm text-[#282824] flex items-center justify-between">
            <span>الحجوزات الفندقية اليومية ({filteredBookings.length})</span>
          </div>
          <div className="overflow-x-auto custom-horizontal-scrollbar">
            <table className="w-full text-right border-collapse text-xs min-w-[750px]">
              <thead className="bg-[#FAF8F5]">
                <tr>
                  <th className="p-3.5 font-bold text-[#282824]">رقم الحجز</th>
                  <th className="p-3.5 font-bold text-[#282824]">اسم النزيل وبيانات الهاتف</th>
                  <th className="p-3.5 font-bold text-[#282824]">رقم الشقة والموقع</th>
                  <th className="p-3.5 font-bold text-[#282824]">فترة الإقامة</th>
                  <th className="p-3.5 font-bold text-[#282824]">الإجمالي المعتمد</th>
                  <th className="p-3.5 font-bold text-[#282824]">رمز القفل الذكي</th>
                  <th className="p-3.5 font-bold text-[#282824]">الإجراءات الميدانية</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E3DCCD]">
                {filteredBookings.map(b => {
                  const unit = state.units.find(u => u.id === b.unitId);
                  const prop = state.properties.find(p => p.id === (b.propertyId || unit?.propertyId));
                  return (
                    <tr key={b.id} className="hover:bg-[#FFFCF6] transition-colors">
                      <td className="p-3.5 font-bold text-[#282824] font-mono select-all">
                        {b.bookingNumber}
                      </td>
                      <td className="p-3.5">
                        <div className="font-semibold text-[#282824]">{b.guest?.fullName || (b as any).guestName || 'نزيل معتمد'}</div>
                        <span className="text-[11px] text-[#68675F]" dir="ltr">{b.guest?.phone || (b as any).guestPhone}</span>
                      </td>
                      <td className="p-3.5">
                        <div className="font-bold text-[#282824]">شقة #{unit?.unitNumber || 'مخصصة'}</div>
                        <span className="text-[11px] text-[#68675F]">{prop?.name || 'مجمع الفخامة'}</span>
                      </td>
                      <td className="p-3.5">
                        <span className="tabular-nums font-semibold">
                          <bdi dir="ltr">{formatDate(b.checkIn || (b as any).startDate)}</bdi> إلى <bdi dir="ltr">{formatDate(b.checkOut || (b as any).endDate)}</bdi>
                        </span>
                        <span className="block text-[10px] text-[#68675F]">({b.totalNights || 1} ليلة)</span>
                      </td>
                      <td className="p-3.5 font-bold text-[#282824]">
                        <CurrencyAmount amount={Number(b.totalAmount) || 0} />
                      </td>
                      <td className="p-3.5">
                        <span className="px-2 py-1 bg-[#282824] text-[#B69A68] rounded font-mono font-bold text-xs">
                          {b.smartLockPin || '884210'}
                        </span>
                      </td>
                      <td className="p-3.5">
                        <div className="flex items-center gap-1.5">
                          {b.status === 'confirmed' && (
                            <>
                              <button
                                type="button"
                                disabled={isSubmitting}
                                onClick={() => handleCheckIn(b.id)}
                                className="px-2.5 py-1 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg font-bold flex items-center gap-1 transition-colors cursor-pointer"
                              >
                                <LogIn className="w-3.5 h-3.5 text-white" />
                                <span>دخول</span>
                              </button>
                              <button
                                type="button"
                                disabled={isSubmitting}
                                onClick={() => handleCancelBooking(b.id)}
                                className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200 rounded-lg font-bold flex items-center gap-1 transition-colors cursor-pointer"
                              >
                                <XCircle className="w-3.5 h-3.5 text-rose-600" />
                                <span>إلغاء</span>
                              </button>
                            </>
                          )}
                          {b.status === 'checked_in' && (
                            <button
                              type="button"
                              disabled={isSubmitting}
                              onClick={() => handleCheckOut(b.id)}
                              className="px-2.5 py-1 bg-rose-700 hover:bg-rose-800 text-white rounded-lg font-bold flex items-center gap-1 transition-colors cursor-pointer"
                            >
                              <LogOut className="w-3.5 h-3.5 text-white" />
                              <span>خروج</span>
                            </button>
                          )}
                          {b.status === 'completed' && (
                            <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded font-bold border border-emerald-200 select-none">
                              مغادر مكتمل
                            </span>
                          )}
                          {b.status === 'cancelled' && (
                            <span className="text-gray-500 bg-gray-100 px-2 py-0.5 rounded font-bold border border-gray-300 select-none">
                              ملغى ومحرر
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Leases List (Monthly & Yearly) */}
      {(activeTab === 'all' || activeTab === 'monthly' || activeTab === 'yearly') && filteredLeases.length > 0 && (
        <div className="space-y-4">
          <div className="p-4 bg-[#F7F3EB] rounded-2xl border border-[#E3DCCD] font-bold text-sm text-[#282824]">
            عقود الإيجار الموثقة (الشهرية والسنوية - {filteredLeases.length})
          </div>

          {filteredLeases.map(lease => {
            const unit = state.units.find(u => u.id === lease.unitId);
            const prop = state.properties.find(p => p.id === (lease.propertyId || unit?.propertyId));
            const isYearly = lease.rentalType === 'yearly' || (lease as any).type === 'yearly' || (lease as any).rentalType === 'annual';
            const installments = lease.installments || [];

            return (
              <div key={lease.id} className="bg-white rounded-3xl p-5 border border-[#E3DCCD] shadow-xs space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-[#E3DCCD] gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className={`px-2.5 py-0.5 rounded text-[10px] font-bold ${
                        isYearly ? 'bg-amber-100 text-amber-900 border border-amber-300' : 'bg-blue-100 text-blue-800 border border-blue-300'
                      }`}>
                        {isYearly ? '📜 عقد سنوي رسمي' : '🏢 عقد إيجار شهري'}
                      </span>
                      <span className="text-xs font-mono font-bold text-[#282824]">#{lease.contractNumber}</span>
                      {((lease.status as string) === 'terminated_early' || lease.status === 'terminated') && (
                        <span className="px-2 py-0.5 rounded bg-rose-100 text-rose-800 border border-rose-300 font-bold text-[10px]">
                          منتهٍ مبكراً ({lease.endDate})
                        </span>
                      )}
                    </div>
                    <h4 className="font-bold text-base text-[#282824] mt-1">
                      المستأجر: {lease.tenant?.fullName || (lease as any).tenantName}
                    </h4>
                    <span className="text-xs text-[#68675F] block mt-1">
                      {prop?.name} · شقة #{unit?.unitNumber} ({isYearly ? 'سنة واحدة' : `${lease.monthsCount || 1} شهر`} · من {lease.startDate?.slice(0, 10)} إلى {lease.endDate?.slice(0, 10)})
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="text-right sm:text-left select-none">
                      <span className="text-xs text-[#68675F] block mb-0.5">القيمة التعاقدية الشاملة</span>
                      <div className="text-lg font-bold text-[#282824]">
                        <CurrencyAmount amount={Number((lease as any).annualRent) || Number(lease.yearlyRent) || Number(lease.totalContractValue) || 0} />
                      </div>
                      <span className="block text-[10px] text-[#68675F]">
                        {(lease.yearlyPaymentOption === 'semi_annual' || (lease as any).yearlyPaymentOption === '2_payments' || (lease as any).paymentOption === '2_payments') ? 'سداد بدفعتين (نصف سنويتين)' : (lease.yearlyPaymentOption === 'single_annual' || (lease as any).yearlyPaymentOption === '1_payment' || (lease as any).paymentOption === '1_payment') ? 'دفعة سنوية واحدة' : 'أقساط مجدولة'}
                      </span>
                    </div>

                    <div className="flex flex-col gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => setSelectedLeaseDetails(lease)}
                        className="px-3 py-1.5 bg-[#F7F3EB] hover:bg-[#EFE9DF] text-[#282824] rounded-xl font-bold flex items-center gap-1 border border-[#E3DCCD] transition-colors cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5 text-[#B69A68]" />
                        <span>الشروط والمحضر</span>
                      </button>

                      {lease.status === 'active' && (
                        <button
                          type="button"
                          onClick={() => {
                            setTerminateModalLease(lease);
                            setTerminationDate(new Date().toISOString().slice(0, 10));
                          }}
                          className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200 rounded-xl font-bold flex items-center gap-1 transition-colors cursor-pointer"
                        >
                          <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                          <span>إنهاء مبكر</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Installments Schedule */}
                <div>
                  <h5 className="font-bold text-xs text-[#282824] mb-2 select-none">جدول الأقساط والدفعات المعتمدة (بدون فروق هللات):</h5>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
                    {installments.map((inst: any, idx: number) => {
                      const amount = Number(inst.amount) || 0;
                      const dueDate = inst.dueDate ? String(inst.dueDate).slice(0, 10) : '';
                      return (
                        <div
                          key={inst.id || idx}
                          className={`p-2.5 rounded-xl border text-center ${
                            inst.status === 'paid' ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-[#E3DCCD]'
                          }`}
                        >
                          <span className="block text-[10px] text-[#68675F] select-none">{inst.label || `الدفعة رقم ${inst.installmentNumber || inst.number || idx + 1}`}</span>
                          <div className="text-xs font-bold text-[#282824]">
                            <CurrencyAmount amount={amount} />
                          </div>
                          <span className="text-[10px] text-[#68675F] block mt-0.5 tabular-nums">
                            <bdi dir="ltr">{dueDate ? formatDate(dueDate) : ''}</bdi>
                          </span>
                          <span className={`inline-block mt-1 px-1.5 py-0.2 rounded text-[10px] font-bold ${
                            inst.status === 'paid' ? 'text-emerald-800' : 'text-amber-800'
                          }`}>
                            {inst.status === 'paid' ? 'تم الاستلام' : 'مستحق السداد'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Empty State */}
      {filteredBookings.length === 0 && filteredLeases.length === 0 && (
        <div className="text-center py-16 bg-white rounded-3xl border border-[#E3DCCD] p-6 space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-[#F7F3EB] flex items-center justify-center mx-auto text-[#B69A68]">
            <Info className="w-6 h-6" />
          </div>
          <h4 className="text-base font-bold text-[#282824]">لا توجد معاملات أو عقود مطابقة لخيار الفلترة الحالي</h4>
          <p className="text-xs text-[#68675F] max-w-sm mx-auto">
            لم يتم العثور على أي حجز يومي أو عقد إيجار يطابق بحثك. جرب إعادة تعيين البحث أو اختيار تبويب آخر.
          </p>
          <button
            type="button"
            onClick={() => {
              setActiveTab('all');
              setSearchQuery('');
            }}
            className="px-4 py-2 bg-[#282824] text-[#B69A68] font-bold rounded-xl text-xs hover:bg-[#1a1a18] transition-colors cursor-pointer"
          >
            عرض كافة المعاملات
          </button>
        </div>
      )}

      {/* Early Termination Modal */}
      {terminateModalLease && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white w-full max-w-md rounded-3xl p-6 border border-[#E3DCCD] shadow-2xl space-y-4 text-right">
            <div className="flex items-center justify-between pb-3 border-b border-[#E3DCCD]">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-600" />
                <h4 className="font-bold text-sm text-[#282824]">توثيق إنهاء مبكر للعقد</h4>
              </div>
              <button
                onClick={() => setTerminateModalLease(null)}
                className="p-1 text-gray-500 hover:text-black rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-[#68675F]">
              عقد رقم #{terminateModalLease.contractNumber} للمستأجر {terminateModalLease.tenant?.fullName || terminateModalLease.tenantName}.
              سيتم تعديل التخصيص الزمني في UnitAllocation لتحرير الفترة المتبقية فوراً لإعادة التأجير، مع الحفاظ على الأقساط المسددة.
            </p>

            <form onSubmit={handleEarlyTerminateSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-[#282824] mb-1">تاريخ الإنهاء الفعلي *</label>
                <input
                  type="date"
                  required
                  value={terminationDate}
                  onChange={(e) => setTerminationDate(e.target.value)}
                  className="w-full p-2.5 bg-[#F7F3EB]/60 border border-[#E3DCCD] rounded-xl text-xs text-right focus:outline-none focus:border-[#B69A68]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#282824] mb-1">سبب الإنهاء والتسوية *</label>
                <textarea
                  required
                  rows={3}
                  value={terminationReason}
                  onChange={(e) => setTerminationReason(e.target.value)}
                  placeholder="بيان سبب الإنهاء الرضائي أو التخارج المالي..."
                  className="w-full p-2.5 bg-[#F7F3EB]/60 border border-[#E3DCCD] rounded-xl text-xs text-right focus:outline-none focus:border-[#B69A68]"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setTerminateModalLease(null)}
                  className="px-4 py-2 border border-[#E3DCCD] rounded-xl text-xs font-semibold hover:bg-gray-50"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-rose-700 hover:bg-rose-800 text-white font-bold rounded-xl text-xs flex items-center gap-1"
                >
                  <AlertTriangle className="w-4 h-4 text-white" />
                  <span>{isSubmitting ? 'جاري الحفظ...' : 'تأكيد الإنهاء وتحديث التخصيص'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Contract Terms & Handover Snapshot Modal */}
      {selectedLeaseDetails && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white w-full max-w-xl rounded-3xl p-6 border border-[#E3DCCD] shadow-2xl space-y-4 text-right my-auto">
            <div className="flex items-center justify-between pb-3 border-b border-[#E3DCCD]">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-[#B69A68]" />
                <h4 className="font-bold text-sm text-[#282824]">
                  الشروط الثابتة ومحضر التسليم لعقد #{selectedLeaseDetails.contractNumber}
                </h4>
              </div>
              <button
                onClick={() => setSelectedLeaseDetails(null)}
                className="p-1 text-gray-500 hover:text-black rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
              {/* Snapshot of Pricing & Responsibilities */}
              <div className="p-3.5 bg-[#F7F3EB] rounded-2xl border border-[#E3DCCD] space-y-2">
                <h5 className="font-bold text-xs text-[#282824]">نسخة الشروط والمسؤوليات المعتمدة وقت العقد (Snapshot):</h5>
                <div className="grid grid-cols-2 gap-2 text-[11px] text-[#68675F]">
                  <div>فاتورة الكهرباء: <strong className="text-[#282824]">{selectedLeaseDetails.contractServices?.responsibilities?.electricity === 'tenant' ? 'على المستأجر' : 'مشمولة بالكامل'}</strong></div>
                  <div>فاتورة المياه: <strong className="text-[#282824]">{selectedLeaseDetails.contractServices?.responsibilities?.water === 'tenant' ? 'على المستأجر' : 'مشمولة بالكامل'}</strong></div>
                  <div>خدمة الإنترنت: <strong className="text-[#282824]">مشمول (ألياف بصرية سريعة)</strong></div>
                  <div>الصيانة الدورية: <strong className="text-[#282824]">على المنشأة طوال العقد</strong></div>
                </div>
              </div>

              {/* Handover & Delivery Report */}
              <div className="p-3.5 bg-white rounded-2xl border border-[#E3DCCD] space-y-2">
                <h5 className="font-bold text-xs text-[#282824]">محضر تسليم الشقة والمحتويات (Handover Protocol):</h5>
                <p className="text-[11px] text-[#68675F]">
                  حالة الشقة وقت التسليم: <strong className="text-emerald-700">ممتازة ونظيفة وجاهزة للسكن</strong>
                </p>
                <p className="text-[11px] text-[#68675F]">
                  تسليم المفاتيح: تم تسليم عدد (2) بطاقة دخول ذكية ومفتاح الأمان الرئيسي.
                </p>
              </div>

              {/* Standard Terms */}
              <div className="p-3.5 bg-white rounded-2xl border border-[#E3DCCD] space-y-1">
                <h5 className="font-bold text-xs text-[#282824]">الشروط والأحكام الإضافية:</h5>
                <p className="text-[11px] text-[#68675F] leading-relaxed">
                  {selectedLeaseDetails.termsConditions || 'عقد إيجار رسمي سكني معتمد بنظام إيجار الموحد مع التزام الطرفين بالسياسات والأنظمة المعتمدة.'}
                </p>
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-[#E3DCCD]">
              <button
                type="button"
                onClick={() => setSelectedLeaseDetails(null)}
                className="px-4 py-2 bg-[#282824] text-[#B69A68] font-bold rounded-xl text-xs hover:bg-[#1a1a18]"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
