import React, { useState } from 'react';
import { useAppStore } from '../../store/useAppStore';
import {
  CalendarDays,
  FileText,
  Search,
  LogIn,
  LogOut,
  ShieldCheck,
  Building2
} from 'lucide-react';

export const BookingsLeasesManager: React.FC = () => {
  const { state, checkInBooking, checkOutBooking } = useAppStore();
  const [activeTab, setActiveTab] = useState<'all' | 'daily' | 'monthly' | 'yearly'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredBookings = state.bookings.filter(b => {
    if (activeTab === 'monthly' || activeTab === 'yearly') return false;
    if (!searchQuery) return true;
    return (
      b.bookingNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.guest.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.guest.phone.includes(searchQuery)
    );
  });

  const filteredLeases = state.leases.filter(l => {
    if (activeTab === 'daily') return false;
    if (activeTab === 'monthly' && l.type !== 'monthly') return false;
    if (activeTab === 'yearly' && l.type !== 'yearly') return false;
    if (!searchQuery) return true;
    return (
      l.contractNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      l.tenant.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      l.tenant.phone.includes(searchQuery)
    );
  });

  return (
    <div className="space-y-6 text-xs text-right">
      
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
            <span>عقود شهرية ({state.leases.filter(l => l.type === 'monthly').length})</span>
          </button>

          <button
            onClick={() => setActiveTab('yearly')}
            className={`px-3.5 py-2 rounded-lg font-bold transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              activeTab === 'yearly' ? 'bg-[#282824] text-white shadow-xs' : 'text-[#68675F] hover:text-[#282824]'
            }`}
          >
            <ShieldCheck className="w-4 h-4 text-[#B69A68]" />
            <span>عقود سنوية ({state.leases.filter(l => l.type === 'yearly').length})</span>
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
            <table className="w-full text-right border-collapse text-xs min-w-[700px]">
              <thead className="bg-[#FAF8F5]">
                <tr>
                  <th className="p-3.5 font-bold text-[#282824]">رقم الحجز</th>
                  <th className="p-3.5 font-bold text-[#282824]">اسم النزيل وبيانات الهاتف</th>
                  <th className="p-3.5 font-bold text-[#282824]">رقم الشقة والموقع</th>
                  <th className="p-3.5 font-bold text-[#282824]">فترة الإقامة المحتسبة</th>
                  <th className="p-3.5 font-bold text-[#282824]">الإجمالي الكلي</th>
                  <th className="p-3.5 font-bold text-[#282824]">رمز القفل الذكي</th>
                  <th className="p-3.5 font-bold text-[#282824]">حالة الإقامة الميدانية</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E3DCCD]">
                {filteredBookings.map(b => {
                  const unit = state.units.find(u => u.id === b.unitId);
                  const prop = state.properties.find(p => p.id === b.propertyId);
                  return (
                    <tr key={b.id} className="hover:bg-[#FFFCF6] transition-colors">
                      <td className="p-3.5 font-bold text-[#282824] font-mono select-all">
                        {b.bookingNumber}
                      </td>
                      <td className="p-3.5">
                        <div className="font-semibold text-[#282824]">{b.guest.fullName}</div>
                        <span className="text-[11px] text-[#68675F]" dir="ltr">{b.guest.phone}</span>
                      </td>
                      <td className="p-3.5">
                        <div className="font-bold text-[#282824]">شقة #{unit?.unitNumber}</div>
                        <span className="text-[11px] text-[#68675F]">{prop?.name}</span>
                      </td>
                      <td className="p-3.5">
                        <span className="tabular-nums">{b.checkIn} إلى {b.checkOut}</span>
                        <span className="block text-[10px] text-[#68675F]">({b.totalNights} ليلة)</span>
                      </td>
                      <td className="p-3.5 font-bold text-[#282824] tabular-nums">
                        {(b.totalAmount || 0).toLocaleString('ar-SA')} ر.س
                      </td>
                      <td className="p-3.5">
                        <span className="px-2 py-1 bg-[#282824] text-[#B69A68] rounded font-mono font-bold text-xs">
                          {b.smartLockPin || '884210'}
                        </span>
                      </td>
                      <td className="p-3.5">
                        <div className="flex items-center gap-2">
                          {b.status === 'confirmed' && (
                            <button
                              type="button"
                              onClick={() => checkInBooking(b.id)}
                              className="px-2.5 py-1 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg font-bold flex items-center gap-1 transition-colors cursor-pointer"
                            >
                              <LogIn className="w-3.5 h-3.5 text-white" />
                              <span>تسجيل دخول</span>
                            </button>
                          )}
                          {b.status === 'checked_in' && (
                            <button
                              type="button"
                              onClick={() => checkOutBooking(b.id)}
                              className="px-2.5 py-1 bg-rose-700 hover:bg-rose-800 text-white rounded-lg font-bold flex items-center gap-1 transition-colors cursor-pointer"
                            >
                              <LogOut className="w-3.5 h-3.5 text-white" />
                              <span>تسجيل خروج</span>
                            </button>
                          )}
                          {b.status === 'completed' && (
                            <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded font-bold border border-emerald-200 select-none">
                              مغادر مكتمل
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
            const prop = state.properties.find(p => p.id === lease.propertyId);
            const isYearly = lease.type === 'yearly';

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
                    </div>
                    <h4 className="font-bold text-base text-[#282824] mt-1">
                      المستأجر: {lease.tenant.fullName}
                    </h4>
                    <span className="text-xs text-[#68675F] block mt-1">
                      {prop?.name} · شقة #{unit?.unitNumber} ({isYearly ? 'سنة واحدة' : `${lease.monthsCount} شهر`} · من {lease.startDate} إلى {lease.endDate})
                    </span>
                  </div>

                  <div className="text-right sm:text-left select-none">
                    <span className="text-xs text-[#68675F] block mb-0.5">إجمالي القيمة التعاقدية الشاملة</span>
                    <span className="text-lg font-bold text-[#282824] tabular-nums">
                      {lease.totalContractValue.toLocaleString('ar-SA')} ر.س
                    </span>
                    <span className="block text-[10px] text-[#68675F]">
                      {isYearly ? 'سداد بدفعة أو دفعتين' : 'أقساط شهرية ميسرة'}
                    </span>
                  </div>
                </div>

                {/* Installments Schedule */}
                <div>
                  <h5 className="font-bold text-xs text-[#282824] mb-2 select-none">جدول الأقساط والدفعات المستحقة:</h5>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
                    {lease.installments.map(inst => (
                      <div
                        key={inst.id}
                        className={`p-2.5 rounded-xl border text-center ${
                          inst.status === 'paid' ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-[#E3DCCD]'
                        }`}
                      >
                        <span className="block text-[10px] text-[#68675F] select-none">الدفعة رقم {inst.installmentNumber}</span>
                        <strong className="block text-xs font-bold text-[#282824] tabular-nums">
                          {inst.amount.toLocaleString('ar-SA')} ر.س
                        </strong>
                        <span className="text-[10px] text-[#68675F] block mt-0.5 tabular-nums">{inst.dueDate}</span>
                        <span className={`inline-block mt-1 px-1.5 py-0.2 rounded text-[10px] font-bold ${
                          inst.status === 'paid' ? 'text-emerald-800' : 'text-amber-800'
                        }`}>
                          {inst.status === 'paid' ? 'تم الاستلام' : 'مستحق السداد'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {filteredBookings.length === 0 && filteredLeases.length === 0 && (
        <div className="text-center py-12 bg-white rounded-3xl border border-[#E3DCCD] p-6">
          <p className="text-sm font-bold text-[#282824]">لا توجد معاملات أو عقود مطابقة لخيار الفلترة الحالي</p>
          <span className="text-xs text-[#68675F] block mt-1">جرب تغيير كلمة البحث أو تحويل التبويب لعرض باقي الحجوزات والعقود.</span>
        </div>
      )}

    </div>
  );
};
