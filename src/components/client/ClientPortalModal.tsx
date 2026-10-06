import React, { useState } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { Booking } from '../../types';
import { CurrencyAmount, formatDate } from '../../utils/formatters';
import {
  X,
  KeyRound,
  Car,
  ShieldCheck,
  Eye,
  AlertCircle
} from 'lucide-react';

interface ClientPortalModalProps {
  onClose: () => void;
  defaultBookingNumber?: string;
}

export const ClientPortalModal: React.FC<ClientPortalModalProps> = ({
  onClose,
  defaultBookingNumber,
}) => {
  const { state, logSmartLockPinView } = useAppStore();
  const [bookingSearch, setBookingSearch] = useState(defaultBookingNumber || 'IVR-26-9041');
  const [activeBooking, setActiveBooking] = useState<Booking | null>(() => {
    return state.bookings.find(b => b.bookingNumber === (defaultBookingNumber || 'IVR-26-9041')) || state.bookings[0] || null;
  });
  const [pinVisible, setPinVisible] = useState(false);
  const [pinViewError, setPinViewError] = useState<string | null>(null);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPinVisible(false);
    setPinViewError(null);
    const found = state.bookings.find(b =>
      b.bookingNumber.toLowerCase() === bookingSearch.trim().toLowerCase() ||
      b.guest.phone.includes(bookingSearch.trim())
    );
    setActiveBooking(found || null);
  };

  const handleRevealPin = (booking: Booking) => {
    try {
      logSmartLockPinView(booking.id);
      setPinVisible(true);
      setPinViewError(null);
    } catch (err: any) {
      setPinViewError(err.message);
    }
  };

  const unit = activeBooking ? state.units.find(u => u.id === activeBooking.unitId) : null;
  const property = activeBooking ? state.properties.find(p => p.id === activeBooking.propertyId) : null;
  const assignedParking = unit?.assignedParkingId ? state.parkingSpots.find(p => p.id === unit.assignedParkingId) : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/60 backdrop-blur-sm overflow-y-auto">
      <div className="bg-[#FFFCF6] w-full max-w-2xl rounded-3xl overflow-hidden shadow-2xl border border-[#E3DCCD] my-auto text-xs text-right">
        
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-[#E3DCCD] flex items-center justify-between bg-[#F7F3EB]/80">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-[#282824] rounded-xl text-white">
              <KeyRound className="w-5 h-5 text-[#B69A68]" />
            </div>
            <div>
              <h3 className="text-base font-bold text-[#282824]">بوابة النزيل وحجوزاتي وعقودي السكنية</h3>
              <span className="text-[11px] text-[#68675F] block">
                متابعة فورية للحجوزات اليومية والشهرية والتعاقدات السنوية، كود القفل الذكي، وجدول الأقساط
              </span>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-[#68675F] hover:text-[#282824] rounded-full cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search Booking Bar */}
        <div className="p-4 bg-white border-b border-[#E3DCCD]">
          <form onSubmit={handleSearch} className="flex gap-2">
            <input
              type="text"
              placeholder="ابحث برقم الحجز (مثال: IVR-26-9041) أو رقم الجوال..."
              value={bookingSearch}
              onChange={(e) => setBookingSearch(e.target.value)}
              className="flex-1 p-2 bg-[#F7F3EB]/40 border border-[#E3DCCD] rounded-xl text-xs font-semibold text-right focus:outline-none focus:border-[#B69A68]"
            />
            <button
              type="submit"
              className="px-5 py-2 bg-[#282824] text-white font-bold rounded-xl transition-colors cursor-pointer hover:bg-[#1a1a18]"
            >
              استعلام فوري
            </button>
          </form>
        </div>

        {/* Content Body */}
        <div className="p-5 sm:p-6 space-y-6">
          
          {activeBooking ? (
            <div className="space-y-5">
              
              {/* Status and Guest Box */}
              <div className="p-4 bg-[#F7F3EB]/50 rounded-2xl border border-[#E3DCCD] space-y-3">
                <div className="flex items-center justify-between">
                  <span className="px-2.5 py-0.5 rounded bg-[#282824] text-white font-bold text-[11px] font-mono select-all">
                    رقم الحجز: #{activeBooking.bookingNumber}
                  </span>
                  <span className={`px-2.5 py-0.5 rounded font-bold text-[11px] ${
                    activeBooking.status === 'checked_in' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                  }`}>
                    {activeBooking.status === 'checked_in' ? 'تم الدخول للشقة' : 'حجز مؤكد'}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs text-right">
                  <div>
                    <span className="text-[#68675F] block text-[10px]">الاسم الكامل للضيف:</span>
                    <strong className="text-[#282824]">{activeBooking.guest.fullName}</strong>
                  </div>
                  <div>
                    <span className="text-[#68675F] block text-[10px]">المجمع السكني والشقة:</span>
                    <strong className="text-[#282824]">{property?.name} · شقة #{unit?.unitNumber}</strong>
                  </div>
                  <div>
                    <span className="text-[#68675F] block text-[10px]">تاريخ الدخول والوصول:</span>
                    <strong className="text-[#282824]">{activeBooking.checkIn} (٣:٠٠ م)</strong>
                  </div>
                  <div>
                    <span className="text-[#68675F] block text-[10px]">تاريخ المغادرة والتحرير:</span>
                    <strong className="text-[#282824]">{activeBooking.checkOut} (١٢:٠٠ م)</strong>
                  </div>
                </div>
              </div>

              {/* SMART LOCK PASS SECTION */}
              <div className="p-5 bg-gradient-to-br from-[#282824] to-[#1a1a18] text-white rounded-3xl shadow-lg space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <KeyRound className="w-5 h-5 text-[#B69A68]" />
                    <strong className="text-sm font-bold text-white">بطاقة الدخول الذكية للغرفة</strong>
                  </div>
                  <span className="text-[10px] text-emerald-400 flex items-center gap-1 font-semibold">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>آمن ومحمي بالكامل</span>
                  </span>
                </div>

                <div className="bg-white/10 rounded-2xl p-4 border border-white/10 text-center space-y-2">
                  <span className="text-xs text-[#EFE9DF]/80 block font-semibold">
                    الرمز السري للقفل الرقمي الذكي للباب
                  </span>
                  
                  {pinVisible ? (
                    <div className="space-y-1">
                      <span className="text-3xl font-mono font-bold tracking-widest text-[#B69A68] block">
                        {activeBooking.smartLockPin || '829410#'}
                      </span>
                      <span className="text-[10px] text-[#EFE9DF]/60 block">
                        صالح للدخول حتى تاريخ {activeBooking.checkOut} الساعة ١٢:٠٠ مساءً
                      </span>
                    </div>
                  ) : (
                    <div>
                      <span className="text-2xl font-mono text-[#EFE9DF]/40 block tracking-widest mb-2 select-none">
                        ••••••
                      </span>
                      <button
                        onClick={() => handleRevealPin(activeBooking)}
                        className="px-4 py-2 bg-[#B69A68] hover:bg-[#a68a58] text-white font-bold rounded-xl text-xs transition-colors flex items-center justify-center gap-1.5 mx-auto cursor-pointer"
                      >
                        <Eye className="w-4 h-4" />
                        <span>كشف الرمز السري الفندقي</span>
                      </button>
                    </div>
                  )}

                  {pinViewError && (
                    <span className="text-rose-400 text-[11px] block mt-1">{pinViewError}</span>
                  )}
                </div>

                <p className="text-[11px] text-[#EFE9DF]/70 leading-relaxed text-center">
                  أدخل الرمز متبوعًا بعلامة المربع (#) لفتح الباب الذكي. الرمز مراقب ومرصود بسجل الأمان لأغراض النزاهة والامتثال.
                </p>
              </div>

              {/* DEDICATED PARKING INSTRUCTIONS */}
              <div className="p-4 bg-white rounded-2xl border border-[#E3DCCD] space-y-2">
                <div className="flex items-center gap-2 font-bold text-[#282824]">
                  <Car className="w-4 h-4 text-[#B69A68]" />
                  <span>الموقف الخاص المظلل المخصص للسيارة:</span>
                </div>
                
                {assignedParking ? (
                  <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 text-emerald-900 space-y-1">
                    <div className="flex justify-between font-bold">
                      <span>رقم الموقف المخصص: {assignedParking.spotNumber}</span>
                      <span>الموقع: {assignedParking.locationLabel || assignedParking.location} ({assignedParking.type === 'ev_charging' ? 'شاحن كهربائي' : 'مظلل مغطى'})</span>
                    </div>
                    <p className="text-[11px] text-emerald-800 text-right leading-relaxed mt-1">
                      {assignedParking.instructions || 'موقف سيارتك محدد باسم منزل الفخامة ومسجل برقم شقتك.'}
                    </p>
                  </div>
                ) : (
                  <p className="text-[#68675F] text-xs">
                    لم يتم تعيين موقف خاص ومظلل حصري لهذه الوحدة السكنية حتى الآن.
                  </p>
                )}
              </div>

              {/* FINANCIAL RECEIPT SUMMARY */}
              <div className="p-4 bg-white rounded-2xl border border-[#E3DCCD] space-y-2 text-[#68675F]">
                <div className="flex items-center justify-between font-bold text-[#282824]">
                  <span>ملخص الرصيد وسندات السداد</span>
                  <span className="text-xs text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded font-semibold border border-emerald-200">
                    تم الاستلام والتحصيل بالكامل
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span>قيمة الإقامة الشاملة والخدمات</span>
                  <CurrencyAmount amount={(activeBooking?.totalAmount || 0) - (activeBooking?.securityDeposit || 0)} />
                </div>
                <div className="flex justify-between items-center text-amber-800">
                  <span>تأمين الأثاث المسترد (تفويض معلق)</span>
                  <CurrencyAmount amount={activeBooking?.securityDeposit || 0} />
                </div>
                <div className="flex justify-between items-center pt-2 border-t border-[#E3DCCD] font-black text-[#282824] text-sm">
                  <span>إجمالي الحساب المالي الكلي</span>
                  <CurrencyAmount amount={activeBooking?.totalAmount || 0} />
                </div>
              </div>

            </div>
          ) : (
            <div className="text-center py-10 text-[#68675F] space-y-2">
              <AlertCircle className="w-8 h-8 text-amber-500 mx-auto" />
              <strong className="block text-sm text-[#282824]">لم نتمكن من العثور على الحجز السكني</strong>
              <p>يرجى التأكد من كتابة كود الحجز السكنى بشكل صحيح وبدقة (مثال: IVR-26-9041).</p>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};
