import React, { useState } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { Unit } from '../../types';
import { ImageWithFallback } from '../common/ImageWithFallback';
import { formatNumber, CurrencyAmount, SaudiRiyalSymbol } from '../../utils/formatters';
import {
  X,
  Maximize2,
  Users,
  Bed,
  Bath,
  AlertCircle,
  CheckCircle2,
  Building2,
  CalendarCheck,
  Sparkles,
  MapPin
} from 'lucide-react';

interface UnitDetailModalProps {
  unit: Unit | null;
  initialCheckIn?: string;
  initialCheckOut?: string;
  initialRentalType?: 'daily' | 'monthly' | 'yearly';
  onClose: () => void;
  onProceedToCheckout: (unit: Unit, dates: { checkIn: string; checkOut: string; guests: number; rentalType: 'daily' | 'monthly' | 'yearly' }) => void;
}

export const UnitDetailModal: React.FC<UnitDetailModalProps> = ({
  unit,
  initialCheckIn,
  initialCheckOut,
  initialRentalType = 'daily',
  onClose,
  onProceedToCheckout,
}) => {
  const { state, checkUnitAvailability } = useAppStore();
  const [activeMediaCategory, setActiveMediaCategory] = useState<string>('all');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [rentalType, setRentalType] = useState<'daily' | 'monthly' | 'yearly'>(initialRentalType);
  const [activeTab, setActiveTab] = useState<'specs' | 'spaces' | 'plan' | 'policies'>('specs');

  // Dates state
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const defaultStart = initialCheckIn || tomorrow.toISOString().slice(0, 10);
  
  const nextWeek = new Date(tomorrow);
  nextWeek.setDate(nextWeek.getDate() + 3);
  const defaultEnd = initialCheckOut || nextWeek.toISOString().slice(0, 10);

  const [checkIn, setCheckIn] = useState<string>(defaultStart);
  const [checkOut, setCheckOut] = useState<string>(defaultEnd);
  const [guestsCount, setGuestsCount] = useState<number>(1);

  if (!unit) return null;

  const property = state.properties.find(p => p.id === unit.propertyId);
  const cityName = state.cities.find(c => c.id === property?.cityId)?.name || property?.city || 'الرياض';

  // Filter media by category
  const filteredMedia = unit.media.filter(m => {
    if (activeMediaCategory === 'all') return true;
    return m.category === activeMediaCategory;
  });

  const currentCover = selectedImage || (filteredMedia[0]?.url || unit.media[0]?.url);

  // Check Availability for requested range
  const availability = checkUnitAvailability(unit.id, checkIn, checkOut);

  // Calculate pricing breakdown
  const startMs = new Date(`${checkIn}T15:00:00`).getTime();
  const endMs = new Date(`${checkOut}T12:00:00`).getTime();
  const calculatedNights = Math.max(1, Math.round((endMs - startMs) / (1000 * 60 * 60 * 24)));
  
  const subtotal = (rentalType === 'daily' ? unit.dailyRate : Math.round(unit.monthlyRate / 30)) * calculatedNights;
  const taxes = Math.round((subtotal + unit.cleaningFee) * (unit.taxPercentage / 100));
  const estimatedTotal = subtotal + unit.cleaningFee + taxes + unit.securityDeposit;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/60 backdrop-blur-sm overflow-y-auto">
      <div className="bg-[#FFFCF6] w-full max-w-5xl rounded-3xl overflow-hidden shadow-2xl border border-[#E3DCCD] my-auto max-h-[92vh] flex flex-col">
        
        {/* Header Bar */}
        <div className="p-4 sm:p-6 border-b border-[#E3DCCD] flex items-center justify-between bg-[#F7F3EB]/70">
          <div className="flex items-center gap-3">
            <span className="px-3 py-1 bg-[#282824] text-white text-xs font-bold rounded-lg tracking-wider">
              شقة #{unit.unitNumber}
            </span>
            <div>
              <h2 className="text-base sm:text-xl font-bold text-[#282824] line-clamp-1 text-right">
                {unit.title}
              </h2>
              <span className="text-xs text-[#68675F] flex items-center gap-2 mt-0.5 justify-start flex-wrap">
                <span className="flex items-center gap-1 font-semibold text-[#B69A68]">
                  <MapPin className="w-3.5 h-3.5 shrink-0" />
                  <span>{cityName} ({property?.district})</span>
                </span>
                <span>·</span>
                <span className="flex items-center gap-1">
                  <Building2 className="w-3.5 h-3.5 text-[#68675F]" />
                  <span>{property?.name} · الدور {unit.floorNumber}</span>
                </span>
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-[#68675F] hover:text-[#282824] hover:bg-[#EFE9DF] rounded-full transition-colors cursor-pointer"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Modal Scroll Body */}
        <div className="overflow-y-auto p-4 sm:p-6 space-y-6 flex-1 text-right">
          
          {/* Main Visual Stage & Categories */}
          <div className="space-y-3">
            <div className="relative h-64 sm:h-96 w-full rounded-2xl overflow-hidden bg-[#282824] shadow-md">
              <ImageWithFallback
                src={currentCover}
                alt={unit.title}
                fallbackText={unit.title}
                fit="fill"
                className="w-full h-full"
              />
              <div className="absolute top-4 right-4 flex items-center gap-2">
                <span className="px-3 py-1 rounded-md bg-[#282824]/80 backdrop-blur-md text-xs font-semibold text-white">
                  الدور {unit.floorNumber} · {unit.areaSqm} م² المساحة
                </span>
              </div>
            </div>

            {/* Media Categorization Tabs (Interactive) */}
            <div className="flex items-center gap-1.5 overflow-x-auto p-1 bg-[#EFE9DF]/80 rounded-xl">
              <button
                onClick={() => { setActiveMediaCategory('all'); setSelectedImage(null); }}
                className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
                  activeMediaCategory === 'all' ? 'bg-[#282824] text-white shadow-xs' : 'text-[#68675F] hover:text-[#282824]'
                }`}
              >
                جميع الصور ({unit.media.length})
              </button>
              <button
                onClick={() => { setActiveMediaCategory('living'); setSelectedImage(null); }}
                className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
                  activeMediaCategory === 'living' ? 'bg-[#282824] text-white shadow-xs' : 'text-[#68675F] hover:text-[#282824]'
                }`}
              >
                غرفة الجلوس
              </button>
              <button
                onClick={() => { setActiveMediaCategory('bedroom'); setSelectedImage(null); }}
                className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
                  activeMediaCategory === 'bedroom' ? 'bg-[#282824] text-white shadow-xs' : 'text-[#68675F] hover:text-[#282824]'
                }`}
              >
                غرف النوم
              </button>
              <button
                onClick={() => { setActiveMediaCategory('kitchen'); setSelectedImage(null); }}
                className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
                  activeMediaCategory === 'kitchen' ? 'bg-[#282824] text-white shadow-xs' : 'text-[#68675F] hover:text-[#282824]'
                }`}
              >
                المطبخ
              </button>
              <button
                onClick={() => { setActiveMediaCategory('bathroom'); setSelectedImage(null); }}
                className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
                  activeMediaCategory === 'bathroom' ? 'bg-[#282824] text-white shadow-xs' : 'text-[#68675F] hover:text-[#282824]'
                }`}
              >
                دورات المياه
              </button>
            </div>

            {/* Thumbnail Selector */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              {filteredMedia.map(m => (
                <button
                  key={m.id}
                  onClick={() => setSelectedImage(m.url)}
                  className={`w-20 h-14 rounded-lg overflow-hidden shrink-0 border-2 bg-[#282824] transition-all cursor-pointer ${
                    currentCover === m.url ? 'border-[#B69A68] scale-105 shadow-sm' : 'border-transparent opacity-75 hover:opacity-100'
                  }`}
                >
                  <ImageWithFallback src={m.url} alt={m.title} fit="fill" className="w-full h-full" />
                </button>
              ))}
            </div>
          </div>

          {/* Two-Column Grid: Details vs Live Booking Box */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
            
            {/* Left 2 Cols: Tabs & Specifications */}
            <div className="lg:col-span-2 space-y-6">
              
              {/* Navigation Tabs */}
              <div className="flex items-center gap-4 border-b border-[#E3DCCD]">
                <button
                  onClick={() => setActiveTab('specs')}
                  className={`pb-3 text-xs sm:text-sm font-bold border-b-2 transition-all cursor-pointer ${
                    activeTab === 'specs'
                      ? 'border-[#B69A68] text-[#282824]'
                      : 'border-transparent text-[#68675F] hover:text-[#282824]'
                  }`}
                >
                  المواصفات العامة
                </button>
                <button
                  onClick={() => setActiveTab('spaces')}
                  className={`pb-3 text-xs sm:text-sm font-bold border-b-2 transition-all cursor-pointer ${
                    activeTab === 'spaces'
                      ? 'border-[#B69A68] text-[#282824]'
                      : 'border-transparent text-[#68675F] hover:text-[#282824]'
                  }`}
                >
                  توزيع الفراغات والأثاث ({unit.spaces.length})
                </button>
                {unit.floorPlanUrl && (
                  <button
                    onClick={() => setActiveTab('plan')}
                    className={`pb-3 text-xs sm:text-sm font-bold border-b-2 transition-all cursor-pointer ${
                      activeTab === 'plan'
                        ? 'border-[#B69A68] text-[#282824]'
                        : 'border-transparent text-[#68675F] hover:text-[#282824]'
                    }`}
                  >
                    مخطط الشقة (Floor Plan)
                  </button>
                )}
                <button
                  onClick={() => setActiveTab('policies')}
                  className={`pb-3 text-xs sm:text-sm font-bold border-b-2 transition-all cursor-pointer ${
                    activeTab === 'policies'
                      ? 'border-[#B69A68] text-[#282824]'
                      : 'border-transparent text-[#68675F] hover:text-[#282824]'
                  }`}
                >
                  اللوائح والقوانين
                </button>
              </div>

              {/* Tab 1: Specs & Amenities */}
              {activeTab === 'specs' && (
                <div className="space-y-6 animate-in fade-in duration-150">
                  <div className="grid grid-cols-4 gap-3 p-4 bg-[#F7F3EB]/60 rounded-2xl border border-[#E3DCCD]">
                    <div className="text-center">
                      <span className="block text-[11px] text-[#68675F]">المساحة الكلية</span>
                      <strong className="text-sm font-bold text-[#282824] tabular-nums">{unit.areaSqm} م²</strong>
                    </div>
                    <div className="text-center">
                      <span className="block text-[11px] text-[#68675F]">السعة القصوى</span>
                      <strong className="text-sm font-bold text-[#282824] tabular-nums">{unit.maxGuests} ضيوف</strong>
                    </div>
                    <div className="text-center">
                      <span className="block text-[11px] text-[#68675F]">غرف النوم</span>
                      <strong className="text-sm font-bold text-[#282824] tabular-nums">{unit.bedroomsCount}</strong>
                    </div>
                    <div className="text-center">
                      <span className="block text-[11px] text-[#68675F]">دورات المياه</span>
                      <strong className="text-sm font-bold text-[#282824] tabular-nums">{unit.bathroomsCount}</strong>
                    </div>
                  </div>

                  <div>
                    <h4 className="text-sm font-bold text-[#282824] mb-3">الخدمات الفندقية والتقنية المتاحة بالشقة</h4>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                      {unit.amenities.map(amenityId => {
                        const am = state.amenities.find(a => a.id === amenityId);
                        if (!am) return null;
                        return (
                          <div key={amenityId} className="flex items-center gap-2 p-2.5 rounded-xl bg-white border border-[#E3DCCD] text-xs font-medium text-[#282824]">
                            <Sparkles className="w-3.5 h-3.5 text-[#B69A68] shrink-0" />
                            <span>{am.name}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* Tab 2: Spaces Breakdown */}
              {activeTab === 'spaces' && (
                <div className="space-y-3 animate-in fade-in duration-150">
                  <p className="text-xs text-[#68675F]">تفاصيل جرد قطع الأثاث وقطع التجهيز الموزعة على فراغات الشقة الموثقة رسميًا بمحضر التسليم الفني:</p>
                  <div className="space-y-2">
                    {unit.spaces.map(sp => (
                      <div key={sp.id} className="p-3.5 bg-white rounded-xl border border-[#E3DCCD] flex items-center justify-between text-xs">
                        <div>
                          <strong className="block text-sm text-[#282824] font-bold">{sp.name}</strong>
                          {sp.details && <span className="text-[#68675F] block mt-0.5">{sp.details}</span>}
                        </div>
                        {sp.bedsCount && (
                          <span className="px-2.5 py-1 bg-[#F7F3EB] rounded text-[#B69A68] font-bold text-[10px]">
                            {sp.bedsCount} {sp.bedType || 'أسرة'}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Tab 3: Floor Plan */}
              {activeTab === 'plan' && unit.floorPlanUrl && (
                <div className="space-y-3 animate-in fade-in duration-150">
                  <div className="h-80 rounded-2xl overflow-hidden border border-[#E3DCCD]">
                    <ImageWithFallback src={unit.floorPlanUrl} alt="مخطط الشقة الفندقية" fit="contain" className="w-full h-full bg-[#FFFCF6]" />
                  </div>
                </div>
              )}

              {/* Tab 4: Policies */}
              {activeTab === 'policies' && (
                <div className="space-y-4 text-xs text-[#68675F] leading-relaxed animate-in fade-in duration-150">
                  <div className="p-4 bg-white rounded-xl border border-[#E3DCCD]">
                    <h5 className="font-bold text-sm text-[#282824] mb-1">تسجيل الدخول والمغادرة</h5>
                    <p>تسجيل الدخول يبدأ من الساعة <bdi dir="ltr">3:00</bdi> مساءً، وتوقيت المغادرة هو الساعة <bdi dir="ltr">12:00</bdi> ظهراً لضمان منح طواقم التدبير الوقت الكامل لتجهيز الشقة فندقيًا.</p>
                  </div>
                  <div className="p-4 bg-white rounded-xl border border-[#E3DCCD]">
                    <h5 className="font-bold text-sm text-[#282824] mb-1">مبلغ التأمين وحظر الأثاث</h5>
                    <p className="flex items-center gap-1 flex-wrap">
                      <span>مبلغ التأمين المستحق وقدره</span>
                      <CurrencyAmount amount={unit.securityDeposit} />
                      <span>يتم حجزه إلكترونيًا تفويضًا مؤقتًا على بطاقتك الائتمانية، ويتم فكه وإرجاع الرصيد بالكامل فور فحص الشقة وتوقيع محضر الاستلام الميداني عند المغادرة.</span>
                    </p>
                  </div>
                  <div className="p-4 bg-white rounded-xl border border-[#E3DCCD]">
                    <h5 className="font-bold text-sm text-[#282824] mb-1">شروط الإلغاء المرنة</h5>
                    <p>إلغاء مجاني كامل واسترداد القيمة بنسبة <bdi dir="ltr">100%</bdi> في حال تقديم طلب الإلغاء قبل موعد الدخول بـ <bdi dir="ltr">48</bdi> ساعة على الأقل.</p>
                  </div>
                </div>
              )}
            </div>

            {/* Right 1 Col: Live Booking Box */}
            <div className="glass-ivory p-5 rounded-2xl border border-[#E3DCCD] shadow-md space-y-4">
              <div className="flex items-baseline justify-between pb-3 border-b border-[#E3DCCD]/80">
                <div className="flex items-center gap-1.5">
                  <span className="text-2xl font-bold text-[#282824]">
                    <CurrencyAmount amount={rentalType === 'daily' ? unit.dailyRate : unit.monthlyRate} />
                  </span>
                  <span className="text-xs text-[#68675F]">
                    / {rentalType === 'daily' ? 'الليلة' : 'الشهر'}
                  </span>
                </div>
                <span className="text-[11px] text-[#68675F] font-semibold">
                  حجز فوري آمن
                </span>
              </div>

              {/* Date & Guest Inputs */}
              <div className="space-y-3 text-xs text-right">
                <div>
                  <label className="font-semibold text-[#68675F] block mb-1">تاريخ الدخول</label>
                  <input
                    type="date"
                    value={checkIn}
                    onChange={(e) => setCheckIn(e.target.value)}
                    className="w-full p-2.5 bg-white rounded-lg border border-[#E3DCCD] text-xs font-semibold text-[#282824]"
                  />
                </div>
                <div>
                  <label className="font-semibold text-[#68675F] block mb-1">تاريخ المغادرة</label>
                  <input
                    type="date"
                    value={checkOut}
                    onChange={(e) => setCheckOut(e.target.value)}
                    className="w-full p-2.5 bg-white rounded-lg border border-[#E3DCCD] text-xs font-semibold text-[#282824]"
                  />
                </div>
                <div>
                  <label className="font-semibold text-[#68675F] block mb-1">عدد الضيوف</label>
                  <select
                    value={guestsCount}
                    onChange={(e) => setGuestsCount(Number(e.target.value))}
                    className="w-full p-2 bg-white rounded-lg border border-[#E3DCCD] text-xs font-semibold text-[#282824] cursor-pointer"
                  >
                    {Array.from({ length: unit.maxGuests }, (_, i) => i + 1).map(n => (
                      <option key={n} value={n}>{n} ضيوف كبار</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Real Conflict Check Indicator */}
              <div className="pt-2">
                {availability.available ? (
                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>الجناح متاح وجاهز للحجز الفوري ({calculatedNights} ليلة)</span>
                  </div>
                ) : (
                  <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                    <div>
                      <strong className="block font-bold">غير متاح للتواريخ:</strong>
                      <span>{availability.conflictReason}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Price Breakdown */}
              <div className="pt-2 border-t border-[#E3DCCD]/80 space-y-1.5 text-xs text-[#68675F]">
                <div className="flex justify-between items-center">
                  <span>قيمة الإقامة المخصصة ({calculatedNights} ليلة)</span>
                  <CurrencyAmount amount={subtotal} className="font-medium text-[#282824]" />
                </div>
                <div className="flex justify-between items-center">
                  <span>رسوم التجهيز والتدبير المنزلي</span>
                  <CurrencyAmount amount={unit.cleaningFee} className="font-medium text-[#282824]" />
                </div>
                <div className="flex justify-between items-center">
                  <span>ضريبة القيمة المضافة الحكومية (15%)</span>
                  <CurrencyAmount amount={taxes} className="font-medium text-[#282824]" />
                </div>
                <div className="flex justify-between items-center text-amber-800">
                  <span>تأمين الأثاث المسترد (حجز مؤقت)</span>
                  <CurrencyAmount amount={unit.securityDeposit} className="font-medium" />
                </div>
                <div className="flex justify-between items-center pt-2 border-t border-[#E3DCCD] font-bold text-sm text-[#282824]">
                  <span>إجمالي السعر الشامل</span>
                  <CurrencyAmount amount={estimatedTotal} className="text-[#282824]" />
                </div>
              </div>

              {/* Action Button */}
              <button
                disabled={!availability.available}
                onClick={() => {
                  onClose();
                  onProceedToCheckout(unit, { checkIn, checkOut, guests: guestsCount, rentalType });
                }}
                className={`w-full py-3 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 cursor-pointer ${
                  availability.available
                    ? 'bg-[#282824] hover:bg-[#1a1a18] text-white shadow-md'
                    : 'bg-[#EFE9DF] text-[#68675F]/60 cursor-not-allowed'
                }`}
              >
                <CalendarCheck className="w-4 h-4 text-[#B69A68]" />
                <span>الذهاب لتأكيد الحجز والدفع</span>
              </button>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
};
