import React from 'react';
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
  const sectionMeta = state.contentSections.find(s => s.sectionKey === 'buildings');

  if (sectionMeta && !sectionMeta.visible) return null;

  return (
    <section id="buildings" className="py-16 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      {/* Editorial Header */}
      <div className="max-w-3xl mb-10">
        <div className="inline-flex items-center gap-2 text-xs font-semibold text-[#B69A68] tracking-wider mb-2 select-none">
          <Sparkles className="w-3.5 h-3.5" />
          <span>مجمعات سكنية فاخرة في أرقى أحياء العاصمة</span>
        </div>
        <h2 className="text-2xl sm:text-4xl font-bold text-[#282824] tracking-tight">
          {sectionMeta?.title || 'مواقعنا الحصرية في مدينة الرياض'}
        </h2>
        <p className="text-sm sm:text-base text-[#68675F] mt-3 leading-relaxed">
          {sectionMeta?.subtitle || 'مجمعات سكنية تم انتقاؤها وتجهيزها بأحدث التصاميم المعمارية والمرافق الخدمية الفندقية المتكاملة لتلائم تطلعاتك وتطلعات المقيمين والشركات.'}
        </p>
      </div>

      {/* Buildings Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {state.properties.map((prop) => {
          const coverImage = prop.media.find(m => m.isCover)?.url || prop.media[0]?.url;
          const unitsInProp = state.units.filter(u => u.propertyId === prop.id && u.publicationStatus !== 'archived');
          
          return (
            <div
              key={prop.id}
              className="glass-ivory-card rounded-2xl overflow-hidden border border-[#E3DCCD] hover:border-[#B69A68]/80 transition-all duration-300 hover:shadow-xl group flex flex-col"
            >
              {/* Image Frame */}
              <div className="relative h-64 sm:h-72 w-full overflow-hidden">
                <ImageWithFallback
                  src={coverImage}
                  alt={prop.name}
                  fallbackText={prop.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#282824]/80 via-transparent to-transparent" />
                
                {/* Top Markers (Interactive Filter Controls, unboxed labels) */}
                <div className="absolute top-4 right-4 flex items-center gap-2">
                  <span className="px-3 py-1 rounded-md bg-[#282824]/80 backdrop-blur-md text-xs font-medium text-white border border-white/10">
                    {prop.district}
                  </span>
                  <span className="px-3 py-1 rounded-md bg-[#B69A68]/90 backdrop-blur-md text-xs font-semibold text-white">
                    {unitsInProp.length} جناح فاخر
                  </span>
                </div>

                <div className="absolute bottom-4 right-4 left-4 text-white">
                  <h3 className="text-xl sm:text-2xl font-bold tracking-tight mb-1 text-white">
                    {prop.name}
                  </h3>
                  <div className="flex items-center gap-2 text-xs text-white/80">
                    <MapPin className="w-3.5 h-3.5 text-[#B69A68]" />
                    <span>{prop.address}</span>
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
