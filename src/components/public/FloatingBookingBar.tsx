import React from 'react';
import { useAppStore } from '../../store/useAppStore';
import { Building2, Calendar, Users, Search, MoonStar, CalendarRange, ShieldCheck, CreditCard, MapPin } from 'lucide-react';

interface FloatingBookingBarProps {
  selectedCityId?: string;
  onCityChange?: (cityId: string) => void;
  selectedPropertyId: string;
  onPropertyChange: (propId: string) => void;
  rentalType: 'daily' | 'monthly' | 'yearly';
  onRentalTypeChange: (type: 'daily' | 'monthly' | 'yearly') => void;
  annualPaymentTerms?: 'single' | 'semi_annual';
  onAnnualPaymentTermsChange?: (terms: 'single' | 'semi_annual') => void;
  startDate: string;
  onStartDateChange: (date: string) => void;
  endDate: string;
  onEndDateChange: (date: string) => void;
  monthsCount: number;
  onMonthsCountChange: (months: number) => void;
  guestsCount: number;
  onGuestsCountChange: (guests: number) => void;
  onSearch: () => void;
  availableCount?: number;
}

export const FloatingBookingBar: React.FC<FloatingBookingBarProps> = ({
  selectedCityId = 'all',
  onCityChange,
  selectedPropertyId,
  onPropertyChange,
  rentalType,
  onRentalTypeChange,
  annualPaymentTerms = 'single',
  onAnnualPaymentTermsChange,
  startDate,
  onStartDateChange,
  endDate,
  onEndDateChange,
  monthsCount,
  onMonthsCountChange,
  guestsCount,
  onGuestsCountChange,
  onSearch,
  availableCount,
}) => {
  const { state } = useAppStore();

  const filteredProperties = state.properties.filter(p => {
    if (selectedCityId && selectedCityId !== 'all') {
      return p.cityId === selectedCityId || p.city === selectedCityId;
    }
    return true;
  });

  return (
    <div id="search_bar" className="relative z-30 max-w-6xl mx-auto px-3 sm:px-6 -mt-14 mb-16">
      <div className="glass-ivory-card rounded-2xl p-4 sm:p-6 shadow-xl border border-[#E3DCCD]">
        
        {/* Top Controls: 3 Clear Rental Modes */}
        <div className="flex flex-col space-y-3 mb-5 pb-4 border-b border-[#E3DCCD]/60">
          <div className="flex items-center justify-between gap-3">
            
            {/* Scrollable Modes Selector */}
            <div className="flex items-center gap-1.5 p-1 bg-[#EFE9DF]/80 rounded-xl overflow-x-auto custom-horizontal-scrollbar max-w-full">
              
              {/* Mode 1: Daily */}
              <button
                type="button"
                onClick={() => onRentalTypeChange('daily')}
                className={`flex items-center gap-2 px-3.5 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all whitespace-nowrap cursor-pointer shrink-0 ${
                  rentalType === 'daily'
                    ? 'bg-[#282824] text-[#FFFCF6] shadow-xs'
                    : 'bg-[#FFFCF6] text-[#282824] border border-[#E3DCCD] hover:bg-[#F7F3EB]'
                }`}
              >
                <MoonStar className="w-4 h-4 text-[#B69A68]" />
                <span>يومي — إقامة فندقية</span>
              </button>

              {/* Mode 2: Monthly */}
              <button
                type="button"
                onClick={() => onRentalTypeChange('monthly')}
                className={`flex items-center gap-2 px-3.5 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all whitespace-nowrap cursor-pointer shrink-0 ${
                  rentalType === 'monthly'
                    ? 'bg-[#282824] text-[#FFFCF6] shadow-xs'
                    : 'bg-[#FFFCF6] text-[#282824] border border-[#E3DCCD] hover:bg-[#F7F3EB]'
                }`}
              >
                <CalendarRange className="w-4 h-4 text-[#B69A68]" />
                <span>شهري — إقامة ممتدة</span>
              </button>

              {/* Mode 3: Yearly */}
              <button
                type="button"
                onClick={() => onRentalTypeChange('yearly')}
                className={`flex items-center gap-2 px-3.5 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all whitespace-nowrap cursor-pointer shrink-0 ${
                  rentalType === 'yearly'
                    ? 'bg-[#282824] text-[#FFFCF6] shadow-xs'
                    : 'bg-[#FFFCF6] text-[#282824] border border-[#E3DCCD] hover:bg-[#F7F3EB]'
                }`}
              >
                <ShieldCheck className="w-4 h-4 text-[#B69A68]" />
                <span>سنوي — عقد إيجار سنوي</span>
              </button>

            </div>

            {/* Results Count Badge */}
            {availableCount !== undefined && (
              <div className="hidden lg:block text-xs">
                <span className="font-semibold text-[#282824] bg-[#FFFCF6] px-3 py-1.5 rounded-lg border border-[#E3DCCD]">
                  وجدنا {availableCount} شقة سكنية متوفرة
                </span>
              </div>
            )}
          </div>

          {/* Helper Mode Summary */}
          <div className="text-[11px] sm:text-xs text-[#68675F] bg-[#FFFCF6] p-2.5 rounded-xl border border-[#E3DCCD]/60 flex items-center justify-between">
            {rentalType === 'daily' && (
              <span>✨ <strong>الإقامة اليومية الفندقية:</strong> حجز مرن مع دخول ذكي شامل كافة الخدمات والتنظيف اليومي.</span>
            )}
            {rentalType === 'monthly' && (
              <span>🏢 <strong>الإقامة الشهرية الممتدة:</strong> عقود ميسرة تشمل النظافة الأسبوعية وخصومات حتى ١٥٪ للمدد الطويلة.</span>
            )}
            {rentalType === 'yearly' && (
              <span>📜 <strong>العقد السنوي الرسمي:</strong> عقد إيجار موثق لمدة سنة كاملة مع خيارات سداد بدفعة واحدة أو دفعتين.</span>
            )}
          </div>
        </div>

        {/* Input Matrix */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          
          {/* 0. City Selector */}
          <div className="bg-[#FFFCF6] p-3 rounded-xl border border-[#E3DCCD]/80 hover:border-[#B69A68] transition-colors min-w-0">
            <label className="text-xs font-semibold text-[#68675F] block mb-1">
              المدينة
            </label>
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-[#B69A68] shrink-0" />
              <select
                value={selectedCityId}
                onChange={(e) => {
                  if (onCityChange) onCityChange(e.target.value);
                  onPropertyChange('all');
                }}
                className="w-full bg-transparent text-xs sm:text-sm font-medium text-[#282824] focus:outline-none cursor-pointer truncate"
              >
                <option value="all">جميع المدن ({state.cities?.length || 0})</option>
                {state.cities.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.name} {c.region ? `(${c.region.replace('منطقة ', '')})` : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* 1. Property Selector */}
          <div className="bg-[#FFFCF6] p-3 rounded-xl border border-[#E3DCCD]/80 hover:border-[#B69A68] transition-colors min-w-0">
            <label className="text-xs font-semibold text-[#68675F] block mb-1">
              المبنى أو المجمع
            </label>
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-[#B69A68] shrink-0" />
              <select
                value={selectedPropertyId}
                onChange={(e) => onPropertyChange(e.target.value)}
                className="w-full bg-transparent text-xs sm:text-sm font-medium text-[#282824] focus:outline-none cursor-pointer truncate"
              >
                <option value="all">كل المجمعات ({filteredProperties.length})</option>
                {filteredProperties.map(p => (
                  <option key={p.id} value={p.id}>{p.name.split(' - ')[1] || p.name} ({p.district})</option>
                ))}
              </select>
            </div>
          </div>

          {/* 2. Check-in or Start Date */}
          <div className="bg-[#FFFCF6] p-3 rounded-xl border border-[#E3DCCD]/80 hover:border-[#B69A68] transition-colors min-w-0">
            <label className="text-xs font-semibold text-[#68675F] block mb-1">
              {rentalType === 'daily' ? 'تاريخ الدخول' : 'تاريخ بداية العقد'}
            </label>
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-[#B69A68] shrink-0" />
              <input
                type="date"
                value={startDate}
                onChange={(e) => onStartDateChange(e.target.value)}
                className="w-full bg-transparent text-xs sm:text-sm font-medium text-[#282824] focus:outline-none cursor-pointer"
              />
            </div>
          </div>

          {/* 3. Check-out Date OR Duration / Annual Payment Option */}
          <div className="bg-[#FFFCF6] p-3 rounded-xl border border-[#E3DCCD]/80 hover:border-[#B69A68] transition-colors min-w-0">
            {rentalType === 'daily' && (
              <>
                <label className="text-xs font-semibold text-[#68675F] block mb-1">
                  تاريخ المغادرة
                </label>
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-[#B69A68] shrink-0" />
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => onEndDateChange(e.target.value)}
                    className="w-full bg-transparent text-xs sm:text-sm font-medium text-[#282824] focus:outline-none cursor-pointer"
                  />
                </div>
              </>
            )}

            {rentalType === 'monthly' && (
              <>
                <label className="text-xs font-semibold text-[#68675F] block mb-1">
                  مدة الإقامة الشهرية
                </label>
                <div className="flex items-center gap-2">
                  <CalendarRange className="w-4 h-4 text-[#B69A68] shrink-0" />
                  <select
                    value={monthsCount}
                    onChange={(e) => onMonthsCountChange(Number(e.target.value))}
                    className="w-full bg-transparent text-xs sm:text-sm font-medium text-[#282824] focus:outline-none cursor-pointer"
                  >
                    <option value={1}>شهر واحد (إيجار عادي)</option>
                    <option value={2}>شهرين (سعر ميسر)</option>
                    <option value={3}>3 أشهر (شامل كافة الخدمات)</option>
                    <option value={6}>6 أشهر (خصم مالي 10%)</option>
                  </select>
                </div>
              </>
            )}

            {rentalType === 'yearly' && (
              <>
                <label className="text-xs font-semibold text-[#68675F] block mb-1">
                  خطة السداد السنوية
                </label>
                <div className="flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-[#B69A68] shrink-0" />
                  <select
                    value={annualPaymentTerms}
                    onChange={(e) => onAnnualPaymentTermsChange && onAnnualPaymentTermsChange(e.target.value as any)}
                    className="w-full bg-transparent text-xs sm:text-sm font-medium text-[#282824] focus:outline-none cursor-pointer"
                  >
                    <option value="single">دفعة سنوية واحدة (100% مقدم)</option>
                    <option value="semi_annual">دفعتان (كل 6 أشهر)</option>
                  </select>
                </div>
              </>
            )}
          </div>

          {/* 4. Guests & Search Button */}
          <div className="flex items-center gap-2 min-w-0">
            <div className="flex-1 bg-[#FFFCF6] p-3 rounded-xl border border-[#E3DCCD]/80 hover:border-[#B69A68] transition-colors min-w-0">
              <label className="text-xs font-semibold text-[#68675F] block mb-1">
                عدد النزلاء
              </label>
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-[#B69A68] shrink-0" />
                <select
                  value={guestsCount}
                  onChange={(e) => onGuestsCountChange(Number(e.target.value))}
                  className="w-full bg-transparent text-xs sm:text-sm font-medium text-[#282824] focus:outline-none cursor-pointer"
                >
                  <option value={1}>نزيل واحد</option>
                  <option value={2}>نزيلين اثنين</option>
                  <option value={3}>3 ضيوف عوائل</option>
                  <option value={4}>4 ضيوف معاً</option>
                  <option value={6}>6 أشخاص كبار</option>
                </select>
              </div>
            </div>
            
            <button
              type="button"
              onClick={onSearch}
              className="h-full px-5 py-3.5 bg-[#B69A68] hover:bg-[#a68a58] text-[#FFFCF6] font-semibold text-xs sm:text-sm rounded-xl shadow-md transition-all duration-200 flex items-center justify-center gap-2 whitespace-nowrap shrink-0 cursor-pointer active:scale-95"
            >
              <Search className="w-4 h-4" />
              <span>{state.settings.typography?.search_bar?.search_btn?.text || 'بحث وتأكيد الإتاحة'}</span>
            </button>
          </div>

        </div>
      </div>
    </div>
  );
};
