import React from 'react';
import { useAppStore } from '../../store/useAppStore';
import {
  KeyRound,
  Wifi,
  Sparkles,
  Clock,
  Car,
  Utensils,
  Coffee,
  Shirt,
  Dumbbell,
  Eye,
  Tv,
  Briefcase
} from 'lucide-react';

const iconMap: Record<string, React.ReactNode> = {
  KeyRound: <KeyRound className="w-6 h-6 text-[#B69A68]" />,
  Wifi: <Wifi className="w-6 h-6 text-[#B69A68]" />,
  Sparkles: <Sparkles className="w-6 h-6 text-[#B69A68]" />,
  Clock: <Clock className="w-6 h-6 text-[#B69A68]" />,
  Car: <Car className="w-6 h-6 text-[#B69A68]" />,
  Utensils: <Utensils className="w-6 h-6 text-[#B69A68]" />,
  Coffee: <Coffee className="w-6 h-6 text-[#B69A68]" />,
  Shirt: <Shirt className="w-6 h-6 text-[#B69A68]" />,
  Dumbbell: <Dumbbell className="w-6 h-6 text-[#B69A68]" />,
  Eye: <Eye className="w-6 h-6 text-[#B69A68]" />,
  Tv: <Tv className="w-6 h-6 text-[#B69A68]" />,
  Briefcase: <Briefcase className="w-6 h-6 text-[#B69A68]" />,
};

export const AmenitiesSection: React.FC = () => {
  const { state } = useAppStore();
  const sectionMeta = state.contentSections.find(s => s.sectionKey === 'amenities');

  if (sectionMeta && !sectionMeta.visible) return null;

  return (
    <section id="amenities" className="py-16 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="text-center max-w-3xl mx-auto mb-12">
        <div className="inline-flex items-center gap-2 text-xs font-semibold text-[#B69A68] tracking-wider mb-2 select-none">
          <Sparkles className="w-3.5 h-3.5" />
          <span>مزايا استثنائية لراحة لا تضاهى</span>
        </div>
        <h2 className="text-2xl sm:text-4xl font-bold text-[#282824] tracking-tight">
          {sectionMeta?.title || 'مرافق وخدمات فندقية استثنائية'}
        </h2>
        <p className="text-sm sm:text-base text-[#68675F] mt-3">
          {sectionMeta?.subtitle || 'صُممت كل خدمة في منزل الفخامة بعناية بالغة لتغطي شؤونك وتمنحك وقتاً خالصاً للاسترخاء والتركيز على أسلوب حياتك المتميز.'}
        </p>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
        {state.amenities.map(amenity => (
          <div
            key={amenity.id}
            className="glass-ivory-card p-5 rounded-2xl border border-[#E3DCCD] hover:border-[#B69A68] transition-all duration-200 flex flex-col items-start gap-3"
          >
            <div className="p-3 bg-[#EFE9DF]/80 rounded-xl">
              {iconMap[amenity.icon] || <Sparkles className="w-6 h-6 text-[#B69A68]" />}
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#282824] leading-snug">
                {amenity.name}
              </h3>
              <p className="text-xs text-[#68675F] mt-0.5">
                {amenity.nameEn}
              </p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};
