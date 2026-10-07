import React, { useState } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { Unit } from '../../types';
import { ImageWithFallback } from '../common/ImageWithFallback';
import { formatNumber, CurrencyAmount } from '../../utils/formatters';
import {
  Users,
  Maximize2,
  Bed,
  Bath,
  KeyRound,
  CalendarCheck,
  Sparkles,
  MapPin
} from 'lucide-react';

interface FeaturedUnitsCarouselProps {
  filteredUnits?: Unit[];
  rentalType: 'daily' | 'monthly' | 'yearly';
  onSelectUnit: (unit: Unit) => void;
  onBookUnit: (unit: Unit) => void;
}

export const FeaturedUnitsCarousel: React.FC<FeaturedUnitsCarouselProps> = ({
  filteredUnits,
  rentalType,
  onSelectUnit,
  onBookUnit,
}) => {
  const { state } = useAppStore();
  const [activeFilter, setActiveFilter] = useState<'all' | 'studio' | 'apartment' | 'suite' | 'duplex'>('all');

  const rawUnits = filteredUnits || state.units;
  const displayList = rawUnits.filter(unit => {
    if (unit.publicationStatus === 'archived') return false;
    if (activeFilter === 'all') return true;
    return unit.type === activeFilter;
  });

  const sectionMeta = state.contentSections.find(s => s.sectionKey === 'featured_units');

  if (sectionMeta && !sectionMeta.visible) return null;

  return (
    <section id="units" className="py-16 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
        <div>
          <div className="inline-flex items-center gap-2 text-xs font-semibold text-[#B69A68] tracking-wider mb-2 select-none">
            <Sparkles className="w-3.5 h-3.5" />
            <span>باقة من أفخم الأجنحة والشقق الفندقية في الرياض</span>
          </div>
          <h2 className="text-2xl sm:text-4xl font-bold text-[#282824] tracking-tight">
            {sectionMeta?.title || 'أجنحة السكن الفندقية والتشغيلية المتاحة'}
          </h2>
          <p className="text-sm sm:text-base text-[#68675F] mt-2 max-w-2xl">
            {sectionMeta?.subtitle || 'جميع الوحدات مفروشة بالكامل بأرقى قطع الأثاث ومجهزة بأقفال ذكية ودخول مستقل لتلائم تماماً رغبات السكن القصير والسنوي الفاخر.'}
          </p>
        </div>
        
        {/* Filter Segmented Control */}
        <div className="flex items-center gap-1 p-1 bg-[#EFE9DF]/80 rounded-xl border border-[#E3DCCD] self-start md:self-auto overflow-x-auto max-w-full">
          <button
            onClick={() => setActiveFilter('all')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
              activeFilter === 'all'
                ? 'bg-[#282824] text-white shadow-xs'
                : 'text-[#68675F] hover:text-[#282824]'
            }`}
          >
            الكل ({rawUnits.length})
          </button>
          <button
            onClick={() => setActiveFilter('apartment')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
              activeFilter === 'apartment'
                ? 'bg-[#282824] text-white shadow-xs'
                : 'text-[#68675F] hover:text-[#282824]'
            }`}
          >
            شقق فندقية
          </button>
          <button
            onClick={() => setActiveFilter('studio')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
              activeFilter === 'studio'
                ? 'bg-[#282824] text-white shadow-xs'
                : 'text-[#68675F] hover:text-[#282824]'
            }`}
          >
            استديو أعمال
          </button>
          <button
            onClick={() => setActiveFilter('suite')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
              activeFilter === 'suite'
                ? 'bg-[#282824] text-white shadow-xs'
                : 'text-[#68675F] hover:text-[#282824]'
            }`}
          >
            أجنحة ملكية
          </button>
        </div>
      </div>

      {/* Units Grid */}
      {displayList.length === 0 ? (
        <div className="text-center py-16 bg-[#FFFCF6] rounded-2xl border border-[#E3DCCD] p-8">
          <KeyRound className="w-12 h-12 text-[#B69A68] mx-auto mb-3 opacity-50" />
          <h3 className="text-lg font-bold text-[#282824]">لا توجد شقق متاحة ضمن هذه الفئة</h3>
          <p className="text-sm text-[#68675F] mt-1">يرجى تعديل تواريخ البحث أو مجمع السكن أو فئة الإقامة للحصول على نتائج إضافية.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {displayList.map((unit) => {
            const prop = state.properties.find(p => p.id === unit.propertyId);
            const cityName = state.cities.find(c => c.id === prop?.cityId)?.name || prop?.city || 'الرياض';
            const coverMedia = unit.media.find(m => m.isCover)?.url || unit.media[0]?.url;
            return (
              <div
                key={unit.id}
                className="glass-ivory-card rounded-2xl overflow-hidden border border-[#E3DCCD] hover:border-[#B69A68] transition-all duration-300 hover:shadow-lg flex flex-col group"
              >
                {/* Image Frame */}
                <div className="relative h-56 w-full overflow-hidden bg-[#282824]">
                  <ImageWithFallback
                    src={coverMedia}
                    alt={unit.title}
                    fallbackText={unit.title}
                    fit="cover"
                    className="w-full h-full"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#282824]/60 via-transparent to-transparent" />
                  
                  {/* Property & Type Badges (unboxed, clean typography) */}
                  <div className="absolute top-3 right-3 flex items-center gap-1.5 flex-wrap">
                    <span className="px-2.5 py-1 rounded bg-[#B69A68] backdrop-blur-md text-[11px] font-bold text-white shadow-xs">
                      {cityName || 'الرياض'}
                    </span>
                    <span className="px-2.5 py-1 rounded bg-[#282824]/80 backdrop-blur-md text-[11px] font-medium text-white">
                      {prop?.name.split(' - ')[1] || 'منزل الفخامة'}
                    </span>
                    <span className="px-2.5 py-1 rounded bg-[#FFFCF6]/90 backdrop-blur-md text-[11px] font-semibold text-[#282824]">
                      الدور {unit.floorNumber}
                    </span>
                  </div>
                  {/* Unit Number Badge */}
                  <div className="absolute bottom-3 right-3">
                    <span className="px-2.5 py-0.5 rounded bg-[#282824] text-white text-xs font-bold tracking-wider border border-white/20">
                      شقة #{unit.unitNumber}
                    </span>
                  </div>
                </div>

                {/* Body Content */}
                <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                  <div>
                    <div className="flex items-center gap-1 text-xs text-[#B69A68] font-semibold mb-1">
                      <MapPin className="w-3.5 h-3.5 shrink-0" />
                      <span>{cityName} · {prop?.district}</span>
                    </div>
                    <h3 className="text-lg font-bold text-[#282824] leading-snug line-clamp-1 group-hover:text-[#B69A68] transition-colors">
                      {unit.title}
                    </h3>
                    {/* Specifications List */}
                    <div className="mt-3 grid grid-cols-4 gap-2 py-3 border-y border-[#E3DCCD]/60 text-xs text-[#68675F]">
                      <div className="flex flex-col items-center gap-1">
                        <Maximize2 className="w-3.5 h-3.5 text-[#B69A68]" />
                        <span className="tabular-nums font-medium">{unit.areaSqm} م²</span>
                      </div>
                      <div className="flex flex-col items-center gap-1">
                        <Users className="w-3.5 h-3.5 text-[#B69A68]" />
                        <span className="tabular-nums font-medium">{unit.maxGuests} ضيوف</span>
                      </div>
                      <div className="flex flex-col items-center gap-1">
                        <Bed className="w-3.5 h-3.5 text-[#B69A68]" />
                        <span className="tabular-nums font-medium">{unit.bedroomsCount} غرف</span>
                      </div>
                      <div className="flex flex-col items-center gap-1">
                        <Bath className="w-3.5 h-3.5 text-[#B69A68]" />
                        <span className="tabular-nums font-medium">{unit.bathroomsCount} حمام</span>
                      </div>
                    </div>
                  </div>

                  {/* Pricing and Action */}
                  <div className="pt-2">
                    <div className="flex items-baseline justify-between mb-4">
                      <div>
                        {rentalType === 'daily' && (
                          <div className="flex items-center gap-1.5">
                            <span className="text-xl font-bold text-[#282824]">
                              <CurrencyAmount amount={unit.dailyRate} />
                            </span>
                            <span className="text-xs font-normal text-[#68675F]">
                              / الليلة
                            </span>
                          </div>
                        )}

                        {rentalType === 'monthly' && (
                          <div className="flex items-center gap-1.5">
                            <span className="text-xl font-bold text-[#282824]">
                              <CurrencyAmount amount={unit.monthlyRate} />
                            </span>
                            <span className="text-xs font-normal text-[#68675F]">
                              / الشهر
                            </span>
                          </div>
                        )}

                        {rentalType === 'yearly' && (
                          <div className="flex items-center gap-1.5">
                            <span className="text-xl font-bold text-[#282824]">
                              <CurrencyAmount amount={unit.yearlyRate || (unit.monthlyRate * 10)} />
                            </span>
                            <span className="text-xs font-normal text-[#68675F]">
                              / السنة
                            </span>
                          </div>
                        )}
                      </div>
                      <span className="text-[11px] text-[#68675F]">
                        {rentalType === 'yearly' ? 'عقد موثق خيار دفعتين' : 'شامل الخدمات والفواتير'}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => onSelectUnit(unit)}
                        className="py-2.5 px-3 bg-[#FFFCF6] hover:bg-[#EFE9DF] text-[#282824] border border-[#E3DCCD] rounded-xl text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <span>عرض التفاصيل</span>
                      </button>
                      <button
                        onClick={() => onBookUnit(unit)}
                        className="py-2.5 px-3 bg-[#282824] hover:bg-[#1a1a18] text-white rounded-xl text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 shadow-xs cursor-pointer truncate"
                      >
                        <CalendarCheck className="w-3.5 h-3.5 text-[#B69A68] shrink-0" />
                        <span>{rentalType === 'yearly' ? 'متابعة التعاقد السنوي' : 'احجز الشقة'}</span>
                      </button>
                    </div>
                  </div>
                </div>

              </div>
            );
          })}
        </div>
      )}
    </section>
  );
};
