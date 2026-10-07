import React, { useState } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { Property } from '../../types';
import { ImageWithFallback } from '../common/ImageWithFallback';
import { MapPin, Layers, Sparkles, ArrowLeft } from 'lucide-react';

interface BuildingsCarouselProps {
  onSelectProperty: (property: Property) => void;
}

export const BuildingsCarousel: React.FC<BuildingsCarouselProps> = ({
  onSelectProperty,
}) => {
  const { state } = useAppStore();
  const [selectedCityId, setSelectedCityId] = useState<string>('all');
  const sectionMeta = state.contentSections.find(s => s.sectionKey === 'buildings');
  const bldTypo = state.settings.typography?.buildings;

  if (sectionMeta && !sectionMeta.visible) return null;

  const title = bldTypo?.title?.text || sectionMeta?.title || 'مواقع ومجمعات منزل الفخامة الحصرية';
  const subtitle = bldTypo?.subtitle?.text || sectionMeta?.subtitle || 'مجمعات سكنية تم انتقاؤها وتجهيزها بأحدث التصاميم المعمارية والمرافق الخدمية الفندقية المتكاملة لتلائم تطلعاتك وتطلعات المقيمين والشركات.';

  const filteredProperties = state.properties.filter(p => {
    if (selectedCityId === 'all') return true;
    return p.cityId === selectedCityId || p.city === selectedCityId;
  });

  return (
    <section id="buildings" className="py-16 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      {/* Editorial Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-2 text-xs font-semibold text-[#B69A68] tracking-wider mb-2 select-none">
            <Sparkles className="w-3.5 h-3.5" />
            <span>مجمعات سكنية فاخرة في أرقى مدن وأحياء المملكة</span>
          </div>
          <h2 className="text-2xl sm:text-4xl font-bold text-[#282824] tracking-tight">
            {sectionMeta?.title || 'مواقع ومجمعات منزل الفخامة الحصرية'}
          </h2>
          <p className="text-sm sm:text-base text-[#68675F] mt-3 leading-relaxed">
            {sectionMeta?.subtitle || 'مجمعات سكنية تم انتقاؤها وتجهيزها بأحدث التصاميم المعمارية والمرافق الخدمية الفندقية المتكاملة لتلائم تطلعاتك وتطلعات المقيمين والشركات.'}
          </p>
        </div>

        {/* City Filter Segmented Control */}
        <div className="flex items-center gap-1 p-1 bg-[#EFE9DF]/80 rounded-xl border border-[#E3DCCD] self-start md:self-auto overflow-x-auto max-w-full">
          <button
            onClick={() => setSelectedCityId('all')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
              selectedCityId === 'all'
                ? 'bg-[#282824] text-white shadow-xs'
                : 'text-[#68675F] hover:text-[#282824]'
            }`}
          >
            جميع المدن ({state.properties.length})
          </button>
          {state.cities.map(c => {
            const count = state.properties.filter(p => p.cityId === c.id || p.city === c.name).length;
            return (
              <button
                key={c.id}
                onClick={() => setSelectedCityId(c.id)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
                  selectedCityId === c.id
                    ? 'bg-[#282824] text-white shadow-xs'
                    : 'text-[#68675F] hover:text-[#282824]'
                }`}
              >
                {c.name} ({count})
              </button>
            );
          })}
        </div>
      </div>

      {/* Buildings Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {filteredProperties.map((prop) => {
          const coverImage = prop.media.find(m => m.isCover)?.url || prop.media[0]?.url;
          const unitsInProp = state.units.filter(u => u.propertyId === prop.id && u.publicationStatus !== 'archived');
          const cityName = state.cities.find(c => c.id === prop.cityId)?.name || prop.city || 'الرياض';
          
          return (
            <div
              key={prop.id}
              className="glass-ivory-card rounded-2xl overflow-hidden border border-[#E3DCCD] hover:border-[#B69A68]/80 transition-all duration-300 hover:shadow-xl group flex flex-col"
            >
              {/* Image Frame */}
              <div className="relative h-64 sm:h-72 w-full overflow-hidden bg-[#282824]">
                <ImageWithFallback
                  src={coverImage}
                  alt={prop.name}
                  fallbackText={prop.name}
                  fit="cover"
                  className="w-full h-full"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#282824]/80 via-transparent to-transparent" />
                
                {/* Top Markers (Interactive Filter Controls, unboxed labels) */}
                <div className="absolute top-4 right-4 flex items-center gap-2 flex-wrap">
                  <span className="px-3 py-1 rounded-md bg-[#B69A68] text-xs font-bold text-white shadow-xs">
                    {cityName}
                  </span>
                  <span className="px-3 py-1 rounded-md bg-[#282824]/80 backdrop-blur-md text-xs font-medium text-white border border-white/10">
                    {prop.district}
                  </span>
                  <span className="px-3 py-1 rounded-md bg-white/90 backdrop-blur-md text-xs font-semibold text-[#282824]">
                    {unitsInProp.length} جناح فاخر
                  </span>
                </div>

                <div className="absolute bottom-4 right-4 left-4 text-white">
                  <h3 className="text-xl sm:text-2xl font-bold tracking-tight mb-1 text-white">
                    {prop.name}
                  </h3>
                  <div className="flex items-center gap-2 text-xs text-white/80">
                    <MapPin className="w-3.5 h-3.5 text-[#B69A68]" />
                    <span>{cityName} · {prop.district} {prop.address ? `· ${prop.address}` : ''}</span>
                  </div>
                </div>
              </div>

              {/* Body */}
              <div className="p-6 flex-1 flex flex-col justify-between space-y-5">
                <div>
                  <p className="text-sm text-[#68675F] leading-relaxed line-clamp-3">
                    {prop.description}
                  </p>
                  
                  {/* Highlights (Unboxed labels) */}
                  <div className="mt-4 pt-4 border-t border-[#E3DCCD]/60 flex items-center gap-6 text-xs text-[#282824]">
                    <div className="flex items-center gap-1.5 font-medium">
                      <Layers className="w-4 h-4 text-[#B69A68]" />
                      <span>{prop.totalFloors} طوابق سكنية</span>
                    </div>
                    <div>
                      <span>توقيت الدخول: <strong className="font-semibold">{prop.checkInTime}</strong></span>
                    </div>
                    <div>
                      <span>توقيت الخروج: <strong className="font-semibold">{prop.checkOutTime}</strong></span>
                    </div>
                  </div>
                </div>

                {/* Footer Action */}
                <button
                  onClick={() => onSelectProperty(prop)}
                  className="w-full py-3 px-4 bg-[#FFFCF6] hover:bg-[#282824] hover:text-white text-[#282824] border border-[#E3DCCD] rounded-xl text-sm font-semibold transition-all duration-200 flex items-center justify-center gap-2 group/btn cursor-pointer"
                >
                  <span>استكشف المجمع والأجنحة السكنية</span>
                  <ArrowLeft className="w-4 h-4 text-[#B69A68] group-hover/btn:-translate-x-1 transition-transform" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};
