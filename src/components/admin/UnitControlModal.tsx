import React, { useState } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { Unit, OperationalStatus } from '../../types';
import {
  X,
  Sparkles,
  Wrench,
  Slash,
  CheckCircle,
  LogIn,
  LogOut,
  AlertTriangle,
  Clock,
  Building2
} from 'lucide-react';

interface UnitControlModalProps {
  unit: Unit | null;
  onClose: () => void;
}

export const UnitControlModal: React.FC<UnitControlModalProps> = ({
  unit,
  onClose,
}) => {
  const {
    state,
    checkInBooking,
    checkOutBooking,
    updateUnitOperationalStatus,
    reportMaintenanceTask,
    blockUnitPeriod
  } = useAppStore();

  const [activeTab, setActiveTab] = useState<'status' | 'maint' | 'block'>('status');

  // Maintenance form state
  const [maintTitle, setMaintTitle] = useState('');
  const [maintCategory, setMaintCategory] = useState<'plumbing' | 'electrical' | 'hvac' | 'furniture' | 'smart_lock' | 'other'>('hvac');
  const [maintSeverity, setMaintSeverity] = useState<'critical' | 'moderate' | 'low'>('moderate');
  const [maintDesc, setMaintDesc] = useState('');

  // Block form state
  const [blockStart, setBlockStart] = useState(new Date().toISOString().slice(0, 10));
  const [blockEnd, setBlockEnd] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 2);
    return d.toISOString().slice(0, 10);
  });
  const [blockReason, setBlockReason] = useState('حجب إداري مجدول لأعمال التجهيز والفرش');

  if (!unit) return null;

  const property = state.properties.find(p => p.id === unit.propertyId);
  const activeBooking = state.bookings.find(b => b.unitId === unit.id && (b.status === 'confirmed' || b.status === 'checked_in'));
  const activeLease = state.leases.find(l => l.unitId === unit.id && l.status === 'active');

  const handleStatusChange = (newStatus: OperationalStatus) => {
    updateUnitOperationalStatus(unit.id, newStatus);
    onClose();
  };

  const handleCreateMaintenance = (e: React.FormEvent) => {
    e.preventDefault();
    if (!maintTitle) return;
    reportMaintenanceTask({
      unitId: unit.id,
      category: maintCategory,
      severity: maintSeverity,
      title: maintTitle,
      description: maintDesc,
    });
    onClose();
  };

  const handleCreateBlock = (e: React.FormEvent) => {
    e.preventDefault();
    blockUnitPeriod(unit.id, blockStart, blockEnd, blockReason);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/60 backdrop-blur-sm overflow-y-auto">
      <div className="bg-[#FFFCF6] w-full max-w-xl rounded-3xl overflow-hidden shadow-2xl border border-[#E3DCCD] my-auto text-right">
        
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-[#E3DCCD] flex items-center justify-between bg-[#F7F3EB]/80">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-[#282824] rounded-lg text-white">
              <Building2 className="w-5 h-5 text-[#B69A68]" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-[#282824]">
                التحكم والعمليات الفورية للشقة #{unit.unitNumber}
              </h3>
              <span className="text-xs text-[#68675F] block">
                {property?.name} · الدور {unit.floorNumber}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-[#68675F] hover:text-[#282824] hover:bg-[#EFE9DF] rounded-full transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Current State Summary */}
        <div className="p-4 bg-white border-b border-[#E3DCCD] grid grid-cols-3 gap-2 text-center text-xs select-none">
          <div className="p-2 bg-[#F7F3EB]/60 rounded-xl">
            <span className="text-[#68675F] block text-[10px] mb-1">الحالة التشغيلية</span>
            <span className="font-bold text-[#282824]">
              {unit.operationalStatus === 'ready' && 'جاهزة ومطهرة'}
              {unit.operationalStatus === 'needs_cleaning' && 'بحاجة لتنظيف'}
              {unit.operationalStatus === 'in_cleaning' && 'جاري التنظيف الآن'}
              {unit.operationalStatus === 'in_maintenance' && 'تحت الصيانة الفنية'}
              {unit.operationalStatus === 'blocked' && 'محجوبة إدارياً'}
            </span>
          </div>
          <div className="p-2 bg-[#F7F3EB]/60 rounded-xl">
            <span className="text-[#68675F] block text-[10px] mb-1">الحالة الإشغالية</span>
            <span className="font-bold text-[#282824]">
              {unit.occupancyStatus === 'vacant' && 'شاغرة'}
              {unit.occupancyStatus === 'daily_occupied' && 'مسكونة (يومي)'}
              {unit.occupancyStatus === 'monthly_occupied' && 'مسكونة (شهري)'}
              {unit.occupancyStatus === 'occupied_yearly' && 'مسكونة (سنوي)'}
            </span>
          </div>
          <div className="p-2 bg-[#F7F3EB]/60 rounded-xl">
            <span className="text-[#68675F] block text-[10px] mb-1">أول حركة اليوم</span>
            <span className="font-bold text-[#282824]">
              {unit.todayArrival ? (
                <span className="text-amber-800 animate-pulse font-bold">وصول متوقع اليوم</span>
              ) : unit.todayDeparture ? (
                <span className="text-rose-800 font-bold">مغادرة اليوم</span>
              ) : (
                'لا توجد حركات اليوم'
              )}
            </span>
          </div>
        </div>

        {/* Action Tabs */}
        <div className="flex border-b border-[#E3DCCD] text-xs font-semibold select-none">
          <button
            onClick={() => setActiveTab('status')}
            className={`flex-1 py-2.5 text-center transition-colors border-b-2 cursor-pointer ${
              activeTab === 'status' ? 'border-[#B69A68] text-[#282824] bg-[#FFFCF6]' : 'border-transparent text-[#68675F]'
            }`}
          >
            الحالة والتحصيل الفوري
          </button>
          <button
            onClick={() => setActiveTab('maint')}
            className={`flex-1 py-2.5 text-center transition-colors border-b-2 cursor-pointer ${
              activeTab === 'maint' ? 'border-[#B69A68] text-[#282824] bg-[#FFFCF6]' : 'border-transparent text-[#68675F]'
            }`}
          >
            تسجيل بلاغ صيانة
          </button>
          <button
            onClick={() => setActiveTab('block')}
            className={`flex-1 py-2.5 text-center transition-colors border-b-2 cursor-pointer ${
              activeTab === 'block' ? 'border-[#B69A68] text-[#282824] bg-[#FFFCF6]' : 'border-transparent text-[#68675F]'
            }`}
          >
            حظر حجز مجدول
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4">
          
          {/* TAB 1: STATUS & CHECK-IN / CHECK-OUT */}
          {activeTab === 'status' && (
            <div className="space-y-4 text-xs">
              
              {/* Active Booking Controls */}
              {activeBooking && (
                <div className="p-4 bg-amber-50/70 border border-amber-200 rounded-2xl space-y-3">
                  <div className="flex items-center justify-between">
                    <strong className="text-sm font-bold text-amber-900">
                      حجز فعال جارٍ رقم: {activeBooking.bookingNumber}
                    </strong>
                    <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-900 font-bold">
                      {activeBooking.status === 'confirmed' ? 'وصول مؤكد مسبقاً' : 'تم الدخول النشط'}
                    </span>
                  </div>
                  <div className="text-[#68675F] space-y-1 text-right">
                    <div>اسم النزيل: <strong className="text-[#282824]">{activeBooking.guest.fullName}</strong></div>
                    <div>فترة الإقامة: {activeBooking.checkIn} إلى {activeBooking.checkOut}</div>
                  </div>
                  <div className="pt-2 flex items-center gap-2">
                    {activeBooking.status === 'confirmed' && (
                      <button
                        onClick={() => {
                          checkInBooking(activeBooking.id);
                          onClose();
                        }}
                        className="flex-1 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-xl flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <LogIn className="w-4 h-4" />
                        <span>تسجيل دخول فوري (Check-in)</span>
                      </button>
                    )}
                    {activeBooking.status === 'checked_in' && (
                      <button
                        onClick={() => {
                          checkOutBooking(activeBooking.id);
                          onClose();
                        }}
                        className="flex-1 py-2 bg-rose-700 hover:bg-rose-800 text-white font-bold rounded-xl flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <LogOut className="w-4 h-4" />
                        <span>تسجيل خروج فوري (Check-out)</span>
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Monthly Lease Information */}
              {activeLease && (
                <div className="p-4 bg-blue-50/70 border border-blue-200 rounded-2xl text-xs space-y-2 text-right">
                  <strong className="text-sm font-bold text-blue-900 block">
                    عقد إيجار نشط ساري: {activeLease.contractNumber}
                  </strong>
                  <div>اسم المستأجر: <strong className="text-[#282824]">{activeLease.tenant.fullName}</strong></div>
                  <div>مدة الإقامة السكنية: {activeLease.startDate} إلى {activeLease.endDate} ({activeLease.monthsCount} شهر)</div>
                </div>
              )}

              {/* Operational State Quick Change Buttons */}
              <div>
                <label className="font-bold text-[#282824] block mb-2 text-right">تغيير الحالة التشغيلية الفورية:</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => handleStatusChange('ready')}
                    className="p-2.5 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 text-emerald-900 rounded-xl font-semibold flex items-center gap-2 justify-center cursor-pointer"
                  >
                    <CheckCircle className="w-4 h-4 text-emerald-600" />
                    <span>جاهزة ومطهرة (Ready)</span>
                  </button>
                  <button
                    onClick={() => handleStatusChange('needs_cleaning')}
                    className="p-2.5 bg-amber-50 hover:bg-amber-100 border border-amber-300 text-amber-900 rounded-xl font-semibold flex items-center gap-2 justify-center cursor-pointer"
                  >
                    <Sparkles className="w-4 h-4 text-amber-600" />
                    <span>بحاجة لتنظيف (Dirty)</span>
                  </button>
                  <button
                    onClick={() => handleStatusChange('in_cleaning')}
                    className="p-2.5 bg-amber-50 hover:bg-amber-100 border border-amber-300 text-amber-900 rounded-xl font-semibold flex items-center gap-2 justify-center cursor-pointer"
                  >
                    <Clock className="w-4 h-4 text-amber-600" />
                    <span>بدء تنظيف الآن</span>
                  </button>
                  <button
                    onClick={() => handleStatusChange('in_maintenance')}
                    className="p-2.5 bg-purple-50 hover:bg-purple-100 border border-purple-300 text-purple-900 rounded-xl font-semibold flex items-center gap-2 justify-center cursor-pointer"
                  >
                    <Wrench className="w-4 h-4 text-purple-600" />
                    <span>تحت الصيانة الفنية</span>
                  </button>
                </div>
              </div>

            </div>
          )}

          {/* TAB 2: MAINTENANCE REPORT */}
          {activeTab === 'maint' && (
            <form onSubmit={handleCreateMaintenance} className="space-y-3 text-xs text-right">
              <div>
                <label className="font-semibold text-[#68675F] block mb-1">عنوان بلاغ العطل أو الضرر الملاحظ *</label>
                <input
                  type="text"
                  required
                  placeholder="مثال: تسريب مياه تحت مغسلة المطبخ الرئيسية"
                  value={maintTitle}
                  onChange={(e) => setMaintTitle(e.target.value)}
                  className="w-full p-2.5 bg-white border border-[#E3DCCD] rounded-xl text-right focus:outline-none focus:border-[#B69A68]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-[#68675F] block mb-1">فئة العطل الفني</label>
                  <select
                    value={maintCategory}
                    onChange={(e) => setMaintCategory(e.target.value as any)}
                    className="w-full p-2.5 bg-white border border-[#E3DCCD] rounded-xl cursor-pointer"
                  >
                    <option value="hvac">تكييف مركزي وتهوية</option>
                    <option value="plumbing">أنابيب وسباكة ومغاسل</option>
                    <option value="electrical">كهرباء وإنارة وتجهيزات</option>
                    <option value="smart_lock">أقفال ذكية وكروت ذكية</option>
                    <option value="furniture">فرش وتلفيات أثاث</option>
                    <option value="other">أعطال تشغيلية أخرى</option>
                  </select>
                </div>
                <div>
                  <label className="font-semibold text-[#68675F] block mb-1">شدة وخطورة البلاغ</label>
                  <select
                    value={maintSeverity}
                    onChange={(e) => setMaintSeverity(e.target.value as any)}
                    className="w-full p-2.5 bg-white border border-[#E3DCCD] rounded-xl cursor-pointer"
                  >
                    <option value="critical">حرج (حجب الوحدة فورا)</option>
                    <option value="moderate">متوسط (يحتاج فني صيانة)</option>
                    <option value="low">بسيط (يمكن معالجته لاحقاً)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="font-semibold text-[#68675F] block mb-1">وصف تفصيلي وتعليمات إضافية للفنيين</label>
                <textarea
                  rows={2}
                  placeholder="اكتب هنا كافة تفاصيل المعاينة الأولية والأجهزة التالفة..."
                  value={maintDesc}
                  onChange={(e) => setMaintDesc(e.target.value)}
                  className="w-full p-2.5 bg-white border border-[#E3DCCD] rounded-xl text-right focus:outline-none focus:border-[#B69A68]"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2.5 bg-[#282824] hover:bg-[#1a1a18] text-white font-bold rounded-xl transition-colors cursor-pointer"
              >
                حفظ وتسجيل تذكرة صيانة للوحدة
              </button>
            </form>
          )}

          {/* TAB 3: BLOCK UNIT */}
          {activeTab === 'block' && (
            <form onSubmit={handleCreateBlock} className="space-y-3 text-xs text-right">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-[#68675F] block mb-1">تاريخ بداية حظر الحجز</label>
                  <input
                    type="date"
                    required
                    value={blockStart}
                    onChange={(e) => setBlockStart(e.target.value)}
                    className="w-full p-2 bg-white border border-[#E3DCCD] rounded-xl"
                  />
                </div>
                <div>
                  <label className="font-semibold text-[#68675F] block mb-1">تاريخ نهاية حظر الحجز</label>
                  <input
                    type="date"
                    required
                    value={blockEnd}
                    onChange={(e) => setBlockEnd(e.target.value)}
                    className="w-full p-2 bg-white border border-[#E3DCCD] rounded-xl"
                  />
                </div>
              </div>

              <div>
                <label className="font-semibold text-[#68675F] block mb-1">مبرر وسبب حظر وحجب الحجز</label>
                <input
                  type="text"
                  required
                  placeholder="مثال: حجب إداري مجدول لتحديث الفرش الخارجي"
                  value={blockReason}
                  onChange={(e) => setBlockReason(e.target.value)}
                  className="w-full p-2.5 bg-white border border-[#E3DCCD] rounded-xl text-right focus:outline-none focus:border-[#B69A68]"
                />
              </div>

              <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-amber-900 text-[11px] leading-relaxed">
                سيتسبب هذا الإجراء في منع الحجز الفوري للشقة للشواغر الجارية طوال تلك الفترة وتنبيه بوابة النزلاء بحظر التواريخ.
              </div>

              <button
                type="submit"
                className="w-full py-2.5 bg-rose-800 hover:bg-rose-900 text-white font-bold rounded-xl transition-colors cursor-pointer"
              >
                تطبيق حظر حجز الوحدة السكنية
              </button>
            </form>
          )}

        </div>
      </div>
    </div>
  );
};
